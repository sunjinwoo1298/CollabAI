"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Awareness } from "y-protocols/awareness";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import {
  UserPresence,
  WsAuthResponse,
  WS_MESSAGE_CHAT,
  validateRoomChatMessage,
} from "@/types/collaboration";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "unauthorized"
  | "error";

export interface UseYjsRoomResult {
  doc: Y.Doc;
  provider: WebsocketProvider | null;
  awareness: Awareness | null;
  connectionState: ConnectionState;
  isSynced: boolean;
  isServerWaking: boolean;
  connectDuration: number;
  nodesMap: Y.Map<any>;
  edgesMap: Y.Map<any>;
  error: string | null;
  reconnect: () => void;
  updatePresence: (presence: Partial<UserPresence>) => void;
}

export function useYjsRoom(projectId: string | null | undefined): UseYjsRoomResult {
  // Create / maintain single Y.Doc per projectId
  const doc = useMemo(() => new Y.Doc(), [projectId]);
  const nodesMap = useMemo(() => doc.getMap("nodes"), [doc]);
  const edgesMap = useMemo(() => doc.getMap("edges"), [doc]);

  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [isSynced, setIsSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectDuration, setConnectDuration] = useState(0);
  const [isServerWaking, setIsServerWaking] = useState(false);

  const providerRef = useRef<WebsocketProvider | null>(null);
  const isMountedRef = useRef(true);
  const isConnectingRef = useRef(false);
  const isUnauthorizedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Helper to cleanly destroy an existing provider without triggering recursive reconnect loops
  const destroyCurrentProvider = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (providerRef.current) {
      const oldProvider = providerRef.current;
      providerRef.current = null;
      try {
        oldProvider.awareness?.destroy();
        oldProvider.disconnect();
        oldProvider.destroy();
      } catch (e) {
        console.warn("[useYjsRoom] Error destroying provider:", e);
      }
    }

    if (isMountedRef.current) {
      setProvider(null);
      setAwareness(null);
      setIsSynced(false);
    }
  }, []);

  // Timer to track connection duration (detects Render free-tier cold starts)
  useEffect(() => {
    if (connectionState === "connecting" || (connectionState === "disconnected" && !isUnauthorizedRef.current)) {
      if (!durationTimerRef.current) {
        durationTimerRef.current = setInterval(() => {
          setConnectDuration((prev) => {
            const next = prev + 1;
            if (next >= 3) {
              setIsServerWaking(true);
            }
            return next;
          });
        }, 1000);
      }
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      if (connectionState === "connected") {
        setIsServerWaking(false);
        setConnectDuration(0);
      }
    }

    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [connectionState]);

  // Authenticate and establish connection
  const connectRoom = useCallback(async () => {
    if (!projectId || isUnauthorizedRef.current) return;

    // Strict guard: prevent overlapping concurrent connection attempts
    if (isConnectingRef.current) {
      return;
    }

    // Strict guard: if a provider already exists and is connected, don't spawn duplicate
    if (providerRef.current?.wsconnected) {
      return;
    }

    // Cancel any previous in-flight auth fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    isConnectingRef.current = true;
    if (isMountedRef.current) {
      setConnectionState("connecting");
      setError(null);
    }

    try {
      // 1. Fetch short-lived Room JWT from Next.js (Invariant 2 & 5)
      const res = await fetch("/api/ws-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
        signal: abortController.signal,
      });

      if (!isMountedRef.current || abortController.signal.aborted) {
        return;
      }

      // Handle authorization failure
      if (res.status === 401 || res.status === 403) {
        isUnauthorizedRef.current = true;
        setConnectionState("unauthorized");
        setIsServerWaking(false);
        setError("Unauthorized access to this project room");
        destroyCurrentProvider();
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to authorize WebSocket connection (Status ${res.status})`);
      }

      const data: WsAuthResponse = await res.json();
      if (!isMountedRef.current || abortController.signal.aborted) {
        return;
      }

      const { token, wsUrl } = data;
      if (!token) {
        throw new Error("No token returned by authorization endpoint");
      }

      // Destroy previous provider if any before instantiating new one
      destroyCurrentProvider();

      // Proactively trigger Render container wake-up via standard HTTPS health probe
      // (Render free tier wakes up reliably on incoming HTTP traffic)
      try {
        const httpHealthUrl = wsUrl
          .replace(/^wss:\/\//i, "https://")
          .replace(/^ws:\/\//i, "http://")
          .replace(/\/+$/, "") + "/health";

        fetch(httpHealthUrl, { mode: "no-cors", signal: AbortSignal.timeout(4000) }).catch(() => {
          // Non-blocking ping
        });
      } catch {
        // Ignore ping failures
      }

      // 2. Create exactly ONE fresh WebsocketProvider with newly minted JWT token (Invariant 1: projectId === roomId)
      const wsProvider = new WebsocketProvider(wsUrl, projectId, doc, {
        params: { token },
        connect: true,
        maxBackoffTime: 5000, // Faster retry interval for waking Render instances
      });

      // Register room chat message handler on the WebsocketProvider
      wsProvider.messageHandlers[WS_MESSAGE_CHAT] = (
        _encoder: encoding.Encoder,
        decoder: decoding.Decoder,
        p: WebsocketProvider
      ) => {
        try {
          const raw = decoding.readVarString(decoder);
          const parsed = JSON.parse(raw);
          const validation = validateRoomChatMessage(parsed);
          if (validation.valid && validation.message) {
            (p as any).emit("chat-message", [validation.message]);
          }
        } catch (err) {
          console.warn("[useYjsRoom] Failed to handle incoming chat message:", err);
        }
      };

      providerRef.current = wsProvider;
      if (isMountedRef.current) {
        setProvider(wsProvider);
        setAwareness(wsProvider.awareness);
      }

      // 3. Initial presence and user metadata configuration (Invariant 4: Ephemeral presence)
      if (data.user) {
        wsProvider.awareness.setLocalStateField("user", data.user);
      }

      wsProvider.awareness.setLocalStateField("presence", {
        cursor: null,
        isThinking: false,
      });

      // 4. Provider event listeners
      wsProvider.on("sync", (synced: boolean) => {
        if (!isMountedRef.current) return;
        setIsSynced(synced);
      });

      wsProvider.on("status", (event: { status: "connecting" | "connected" | "disconnected" }) => {
        if (!isMountedRef.current) return;

        if (event.status === "connected") {
          setConnectionState("connected");
          setIsServerWaking(false);
          setError(null);
        } else if (event.status === "connecting") {
          setConnectionState("connecting");
        } else if (event.status === "disconnected") {
          if (!isUnauthorizedRef.current) {
            setConnectionState("disconnected");
            setIsSynced(false);
          }
        }
      });

      // 5. Handle socket connection close
      wsProvider.on("connection-close", (event: CloseEvent | null) => {
        if (!isMountedRef.current) return;

        // If event is null, this is a local intentional disconnect/destroy -> DO NOT RECONNECT!
        if (event === null) return;

        // Code 4403 or 403 denotes forbidden
        if (event?.code === 4403 || event?.code === 403) {
          isUnauthorizedRef.current = true;
          setConnectionState("unauthorized");
          setIsServerWaking(false);
          setIsSynced(false);
          setError("Session forbidden: access denied");
          wsProvider.disconnect();
          return;
        }

        // Standard close - mark disconnected (y-websocket handles automatic reconnect attempts with exponential backoff)
        if (!isUnauthorizedRef.current && isMountedRef.current) {
          setConnectionState("disconnected");
          setIsSynced(false);
        }
      });
    } catch (err: any) {
      if (!isMountedRef.current || abortController.signal.aborted) return;
      console.error("[useYjsRoom] Connection error:", err);
      setError(err.message || "Failed to establish real-time collaboration");
      setConnectionState("error");
      setIsSynced(false);
    } finally {
      isConnectingRef.current = false;
    }
  }, [projectId, doc, destroyCurrentProvider]);

  // Safe manual reconnect trigger (guards against duplicate calls)
  const reconnect = useCallback(() => {
    if (isConnectingRef.current) return;
    isUnauthorizedRef.current = false;
    destroyCurrentProvider();
    connectRoom();
  }, [connectRoom, destroyCurrentProvider]);

  // Helper to update ephemeral cursor/presence
  const updatePresence = useCallback((partialPresence: Partial<UserPresence>) => {
    if (!providerRef.current) return;
    const currentPresence = (providerRef.current.awareness.getLocalState()?.presence || {}) as UserPresence;
    providerRef.current.awareness.setLocalStateField("presence", {
      ...currentPresence,
      ...partialPresence,
    });
  }, []);

  // Main lifecycle effect (cleanly bound to projectId and doc only)
  useEffect(() => {
    isMountedRef.current = true;
    isUnauthorizedRef.current = false;
    isConnectingRef.current = false;

    if (projectId) {
      connectRoom();
    }

    return () => {
      isMountedRef.current = false;
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      destroyCurrentProvider();
      doc.destroy();
    };
  }, [projectId, doc, connectRoom, destroyCurrentProvider]);

  return {
    doc,
    provider,
    awareness,
    connectionState,
    isSynced,
    isServerWaking,
    connectDuration,
    nodesMap,
    edgesMap,
    error,
    reconnect,
    updatePresence,
  };
}
