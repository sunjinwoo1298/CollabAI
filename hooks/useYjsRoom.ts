"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Awareness } from "y-protocols/awareness";
import { UserPresence, WsAuthResponse } from "@/types/collaboration";

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
  // Create / maintain single Y.Doc per projectId
  const doc = useMemo(() => new Y.Doc(), [projectId]);
  const nodesMap = useMemo(() => doc.getMap("nodes"), [doc]);
  const edgesMap = useMemo(() => doc.getMap("edges"), [doc]);

  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);

  const providerRef = useRef<WebsocketProvider | null>(null);
  const isMountedRef = useRef(true);
  const isConnectingRef = useRef(false);
  const isUnauthorizedRef = useRef(false);

  // Helper to cleanly destroy an existing provider without triggering recursive reconnect loops
  const destroyCurrentProvider = useCallback(() => {
    if (!providerRef.current) return;
    const oldProvider = providerRef.current;
    providerRef.current = null;

    try {
      // Disconnect and destroy
      oldProvider.destroy();
    } catch (e) {
      console.warn("[useYjsRoom] Error destroying provider:", e);
    }
  }, []);

  // Authenticate and establish connection
  const connectRoom = useCallback(async () => {
    if (!projectId || isUnauthorizedRef.current || isConnectingRef.current) return;

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
      });

      if (!isMountedRef.current) {
        isConnectingRef.current = false;
        return;
      }

      // Handle authorization failure
      if (res.status === 401 || res.status === 403) {
        isUnauthorizedRef.current = true;
        setConnectionState("unauthorized");
        setError("Unauthorized access to this project room");
        destroyCurrentProvider();
        isConnectingRef.current = false;
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

      // Destroy previous provider if any before instantiating new one
      destroyCurrentProvider();

      // 2. Create fresh WebsocketProvider with newly minted JWT token (Invariant 1: projectId === roomId)
      const wsProvider = new WebsocketProvider(wsUrl, projectId, doc, {
        params: { token },
        connect: true,
      });

      providerRef.current = wsProvider;
      if (isMountedRef.current) {
        setProvider(wsProvider);
        setAwareness(wsProvider.awareness);
      }

      // 3. Initial presence configuration (Invariant 4: Ephemeral presence)
      wsProvider.awareness.setLocalStateField("presence", {
        cursor: null,
        isThinking: false,
      });

      // 4. Provider event listeners
      wsProvider.on("status", (event: { status: "connecting" | "connected" | "disconnected" }) => {
        if (!isMountedRef.current) return;

        if (event.status === "connected") {
          setConnectionState("connected");
          setError(null);
        } else if (event.status === "connecting") {
          setConnectionState("connecting");
        } else if (event.status === "disconnected") {
          if (!isUnauthorizedRef.current) {
            setConnectionState("disconnected");
          }
        }
      });

      // 5. Handle socket connection close
      wsProvider.on("connection-close", (event: CloseEvent | null) => {
        if (!isMountedRef.current) return;

        // CRITICAL FIX: If event is null, this is a local intentional disconnect/destroy -> DO NOT RECONNECT!
        if (event === null) return;

        // Code 4403 or 403 denotes forbidden
        if (event?.code === 4403 || event?.code === 403) {
          isUnauthorizedRef.current = true;
          setConnectionState("unauthorized");
          setError("Session forbidden: access denied");
          wsProvider.disconnect();
          return;
        }

        // Standard close - mark disconnected (y-websocket handles automatic reconnect attempts with exponential backoff)
        if (!isUnauthorizedRef.current && isMountedRef.current) {
          setConnectionState("disconnected");
        }
      });
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error("[useYjsRoom] Connection error:", err);
      setError(err.message || "Failed to establish real-time collaboration");
      setConnectionState("error");
    } finally {
      isConnectingRef.current = false;
    }
  }, [projectId, doc, destroyCurrentProvider]);

  // Reconnect trigger
  const reconnect = useCallback(() => {
    isUnauthorizedRef.current = false;
    isConnectingRef.current = false;
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
    isConnectingRef.current = false;

    if (projectId) {
      connectRoom();
    }

    return () => {
      isMountedRef.current = false;
      destroyCurrentProvider();
      doc.destroy();
    };
  }, [projectId, doc, connectRoom, destroyCurrentProvider]);

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
