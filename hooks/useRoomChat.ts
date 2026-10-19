"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { WebsocketProvider } from "y-websocket";
import * as encoding from "lib0/encoding";
import {
  RoomChatMessage,
  validateRoomChatMessage,
  validateSendChatInput,
  WS_MESSAGE_CHAT,
} from "@/types/collaboration";

export interface UseRoomChatOptions {
  projectId?: string | null;
  provider?: WebsocketProvider | null;
  currentUserId?: string | null;
}

export interface UseRoomChatResult {
  messages: RoomChatMessage[];
  isLoadingHistory: boolean;
  isSending: boolean;
  error: string | null;
  sendMessage: (content: string, runId?: string) => Promise<boolean>;
  clearError: () => void;
  refreshHistory: () => Promise<void>;
}

/**
 * Merges a list of existing messages with incoming message(s), deduplicating by ID
 * and sorting chronologically by ISO 8601 server timestamp.
 */
export function mergeMessages(
  existing: RoomChatMessage[],
  incoming: RoomChatMessage | RoomChatMessage[]
): RoomChatMessage[] {
  const incomingArr = Array.isArray(incoming) ? incoming : [incoming];
  const map = new Map<string, RoomChatMessage>();

  for (const m of existing) {
    if (m && typeof m.id === "string") {
      map.set(m.id, m);
    }
  }

  for (const m of incomingArr) {
    const valid = validateRoomChatMessage(m);
    if (valid.valid && valid.message) {
      map.set(valid.message.id, valid.message);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Sends a chat message over an active WebSocket connection using binary encoding.
 */
export function sendWsChatMessage(
  provider: WebsocketProvider,
  content: string,
  id?: string
): boolean {
  if (!provider.ws || provider.ws.readyState !== WebSocket.OPEN) {
    return false;
  }
  try {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, WS_MESSAGE_CHAT);
    encoding.writeVarString(
      encoder,
      JSON.stringify({ content: content.trim(), id })
    );
    provider.ws.send(encoding.toUint8Array(encoder));
    return true;
  } catch (err) {
    console.warn("[useRoomChat] WebSocket send failed:", err);
    return false;
  }
}

export function useRoomChat({
  projectId,
  provider,
  currentUserId,
}: UseRoomChatOptions): UseRoomChatResult {
  const [messages, setMessages] = useState<RoomChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const activeProjectIdRef = useRef<string | null>(projectId || null);

  useEffect(() => {
    activeProjectIdRef.current = projectId || null;
  }, [projectId]);

  // Fetch initial persisted history from authorized API
  const refreshHistory = useCallback(async () => {
    if (!projectId) {
      setMessages([]);
      return;
    }

    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/messages`);
      if (!isMountedRef.current) return;

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch history (Status ${res.status})`);
      }

      const data = await res.json();
      if (Array.isArray(data.messages)) {
        setMessages((prev) => mergeMessages(prev, data.messages));
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        console.warn("[useRoomChat] History retrieval warning:", err.message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingHistory(false);
      }
    }
  }, [projectId]);

  // Initial history load on project change
  useEffect(() => {
    isMountedRef.current = true;
    setMessages([]);
    setError(null);
    refreshHistory();

    return () => {
      isMountedRef.current = false;
    };
  }, [projectId, refreshHistory]);

  // Real-time listener on WebsocketProvider
  useEffect(() => {
    if (!provider || !projectId) return;

    const handleIncomingChatMessage = (incomingMsg: RoomChatMessage) => {
      if (!isMountedRef.current) return;

      const validation = validateRoomChatMessage(incomingMsg);
      if (!validation.valid || !validation.message) return;

      // Strictly verify room identity
      if (validation.message.projectId !== activeProjectIdRef.current) return;

      setMessages((prev) => mergeMessages(prev, validation.message!));
    };

    (provider as any).on("chat-message", handleIncomingChatMessage);

    return () => {
      try {
        (provider as any).off("chat-message", handleIncomingChatMessage);
      } catch {
        // ignore
      }
    };
  }, [provider, projectId]);

  // Submit message through authenticated room chat pathway
  const sendMessage = useCallback(
    async (content: string, runId?: string): Promise<boolean> => {
      const cleanContent = content.trim();
      const cleanRunId = runId?.trim();
      const inputValid = validateSendChatInput({ content: cleanContent, runId: cleanRunId });
      if (!inputValid.valid || !inputValid.input) {
        setError(inputValid.error || "Message content cannot be empty");
        return false;
      }

      if (isSending) return false;
      setIsSending(true);
      setError(null);

      try {
        // 1. Submit through authenticated Next.js API route for guaranteed persistence
        if (projectId) {
          const res = await fetch(
            `/api/projects/${encodeURIComponent(projectId)}/messages`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                content: cleanContent,
                runId: cleanRunId || undefined,
              }),
            }
          );

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Send failed (Status ${res.status})`);
          }

          const confirmedMsg: RoomChatMessage = await res.json();
          const valid = validateRoomChatMessage(confirmedMsg);
          if (valid.valid && valid.message && isMountedRef.current) {
            setMessages((prev) => mergeMessages(prev, valid.message!));
          }

          // If provider is connected, also broadcast via WS as best-effort immediate relay
          if (provider && provider.ws && provider.ws.readyState === WebSocket.OPEN) {
            sendWsChatMessage(provider, cleanContent, confirmedMsg.id);
          }

          return true;
        } else {
          // Offline / standalone test mode fallback
          const localMessage: RoomChatMessage = {
            id: cleanRunId ? `msg_ai_${cleanRunId}` : `local_${Date.now()}`,
            projectId: "standalone",
            senderId: cleanRunId ? "ai-agent" : currentUserId || "user-local",
            sender: cleanRunId ? "Collab AI" : "You",
            role: "user",
            content: cleanContent,
            timestamp: new Date().toISOString(),
          };

          if (isMountedRef.current) {
            setMessages((prev) => mergeMessages(prev, localMessage));
          }
          return true;
        }
      } catch (err: any) {
        if (isMountedRef.current) {
          setError(err.message || "Failed to send message. Please retry.");
        }
        return false;
      } finally {
        if (isMountedRef.current) {
          setIsSending(false);
        }
      }
    },
    [projectId, provider, currentUserId, isSending]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isLoadingHistory,
    isSending,
    error,
    sendMessage,
    clearError,
    refreshHistory,
  };
}
