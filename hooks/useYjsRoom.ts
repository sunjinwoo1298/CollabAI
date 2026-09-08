"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Awareness } from "y-protocols/awareness";
import { AwarenessState, UserPresence, WsAuthResponse } from "@/types/collaboration";

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
  nodesMap: Y.Map<any>;
  edgesMap: Y.Map<any>;
  error: string | null;
  reconnect: () => void;
  updatePresence: (presence: Partial<UserPresence>) => void;
}

export function useYjsRoom(projectId: string | null | undefined): UseYjsRoomResult {
  // Create / maintain Y.Doc per projectId
  const doc = useMemo(() => new Y.Doc(), [projectId]);
  const nodesMap = useMemo(() => doc.getMap("nodes"), [doc]);
  const edgesMap = useMemo(() => doc.getMap("edges"), [doc]);

  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);

  const providerRef = useRef<WebsocketProvider | null>(null);
  const isMountedRef = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnauthorizedRef = useRef(false);

  // Authenticate and establish connection
  const connectRoom = useCallback(async () => {
    if (!projectId || isUnauthorizedRef.current) return;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

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
      });

      if (!isMountedRef.current) return;

      // Handle authorization failure
      if (res.status === 401 || res.status === 403) {
        isUnauthorizedRef.current = true;
        setConnectionState("unauthorized");
        setError("Unauthorized access to this project room");
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to authorize WebSocket connection (Status ${res.status})`);
      }

      const data: WsAuthResponse = await res.json();
      const { token, wsUrl } = data;

      if (!token) {
        throw new Error("No token returned by authorization endpoint");
      }

      // 2. Destroy previous provider instance if any
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }

      // 3. Create fresh WebsocketProvider with newly minted JWT token (Invariant 1: projectId === roomId)
      const wsProvider = new WebsocketProvider(wsUrl, projectId, doc, {
        params: { token },
        connect: true,
      });

      providerRef.current = wsProvider;
      if (isMountedRef.current) {
        setProvider(wsProvider);
        setAwareness(wsProvider.awareness);
      }

      // 4. Initial presence configuration (Invariant 4: Ephemeral presence)
      wsProvider.awareness.setLocalStateField("presence", {
        cursor: null,
        isThinking: false,
      });

      // 5. Provider event listeners
      wsProvider.on("status", (event: { status: "connecting" | "connected" | "disconnected" }) => {
        if (!isMountedRef.current) return;

        if (event.status === "connected") {
          setConnectionState("connected");
          setError(null);
        } else if (event.status === "connecting") {
          setConnectionState("connecting");
        } else if (event.status === "disconnected") {
          // If not permanently unauthorized, mark disconnected and trigger re-auth loop
          if (!isUnauthorizedRef.current) {
            setConnectionState("disconnected");
          }
        }
      });

      // 6. Handle socket connection errors and re-authorization (Invariant 5)
      wsProvider.on("connection-close", (event: CloseEvent | null) => {
        if (!isMountedRef.current) return;

        // Code 4403 or 403 denotes forbidden
        if (event?.code === 4403 || event?.code === 403) {
          isUnauthorizedRef.current = true;
          setConnectionState("unauthorized");
          setError("Session forbidden: access denied");
          wsProvider.disconnect();
          return;
        }

        // Standard reconnect requires re-authorization via POST /api/ws-auth (Invariant 5)
        if (!isUnauthorizedRef.current && isMountedRef.current) {
          setConnectionState("disconnected");
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && !isUnauthorizedRef.current) {
              connectRoom();
            }
          }, 3000);
        }
      });
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error("[useYjsRoom] Connection error:", err);
      setError(err.message || "Failed to establish real-time collaboration");
      setConnectionState("error");

      // Attempt reconnection after backoff if not unauthorized
      if (!isUnauthorizedRef.current) {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && !isUnauthorizedRef.current) {
            connectRoom();
          }
        }, 5000);
      }
    }
  }, [projectId, doc]);

  // Reconnect trigger
  const reconnect = useCallback(() => {
    isUnauthorizedRef.current = false;
    connectRoom();
  }, [connectRoom]);

  // Helper to update ephemeral cursor/presence
  const updatePresence = useCallback((partialPresence: Partial<UserPresence>) => {
    if (!providerRef.current) return;
    const currentPresence = (providerRef.current.awareness.getLocalState()?.presence || {}) as UserPresence;
    providerRef.current.awareness.setLocalStateField("presence", {
      ...currentPresence,
      ...partialPresence,
    });
  }, []);

  // Main lifecycle effect
  useEffect(() => {
    isMountedRef.current = true;
    isUnauthorizedRef.current = false;

    if (projectId) {
      connectRoom();
    }

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      doc.destroy();
    };
  }, [projectId, doc, connectRoom]);

  return {
    doc,
    provider,
    awareness,
    connectionState,
    nodesMap,
    edgesMap,
    error,
    reconnect,
    updatePresence,
  };
}
