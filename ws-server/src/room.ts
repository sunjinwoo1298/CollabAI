import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { WebSocket } from "ws";
import { WsAuthTokenPayload } from "../../types/collaboration";
import { redisManager } from "./redis";

export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;
export const MESSAGE_AUTH = 2;
export const MESSAGE_QUERY_AWARENESS = 3;

function send(conn: WebSocket, message: Uint8Array) {
  if (conn.readyState !== WebSocket.OPEN) return;
  try {
    conn.send(message, (err) => {
      if (err) {
        console.warn("[Room] Error sending message to client:", err.message);
      }
    });
  } catch (err) {
    console.warn("[Room] Exception sending message to client:", err);
  }
}

export class CollaborativeRoom {
  public readonly roomId: string;
  public readonly doc: Y.Doc;
  public readonly awareness: awarenessProtocol.Awareness;
  public readonly conns: Map<WebSocket, Set<number>> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private onDestroyCallback?: (roomId: string) => void;

  constructor(roomId: string, onDestroy?: (roomId: string) => void) {
    this.roomId = roomId;
    this.onDestroyCallback = onDestroy;
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    // Initialize top-level CRDT maps for architecture nodes & edges
    this.doc.getMap("nodes");
    this.doc.getMap("edges");

    this.init();
  }

  private async init() {
    // 1. Attempt to restore active room state from Redis cache
    const cachedState = await redisManager.getCachedDocState(this.roomId);
    if (cachedState) {
      try {
        Y.applyUpdate(this.doc, cachedState, "redis-cache-restore");
        console.log(`[Room ${this.roomId}] Restored active state from Redis cache`);
      } catch (err) {
        console.warn(`[Room ${this.roomId}] Failed to restore cached state:`, err);
      }
    }

    // 2. Subscribe to cross-instance Redis Pub/Sub events
    await redisManager.subscribeToRoom(
      this.roomId,
      (remoteUpdate) => {
        try {
          Y.applyUpdate(this.doc, remoteUpdate, "redis");
          // Broadcast received remote update to local connected clients
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          syncProtocol.writeUpdate(encoder, remoteUpdate);
          this.broadcast(encoding.toUint8Array(encoder));
        } catch (err) {
          console.error(`[Room ${this.roomId}] Error applying remote doc update:`, err);
        }
      },
      (remoteAwareness) => {
        try {
          awarenessProtocol.applyAwarenessUpdate(
            this.awareness,
            remoteAwareness,
            "redis"
          );
        } catch (err) {
          console.error(`[Room ${this.roomId}] Error applying remote awareness:`, err);
        }
      }
    );

    // 3. Document update listener (CRDT mutations)
    this.doc.on("update", (update: Uint8Array, origin: any) => {
      // Broadcast to local clients (except if originated from this conn, syncProtocol handles it)
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);

      this.broadcast(message, origin instanceof WebSocket ? origin : undefined);

      // Fan-out to Redis if the update originated locally (not from Redis)
      if (origin !== "redis" && origin !== "redis-cache-restore") {
        redisManager.publishDocUpdate(this.roomId, update);
      }
    });

    // 4. Awareness update listener (Ephemeral cursors & presence)
    this.awareness.on(
      "update",
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: any) => {
        // Track client IDs associated with this WebSocket connection for clean disconnect cleanup
        if (origin instanceof WebSocket && this.conns.has(origin)) {
          const clientSet = this.conns.get(origin);
          if (clientSet) {
            added.forEach((id) => clientSet.add(id));
            updated.forEach((id) => clientSet.add(id));
            removed.forEach((id) => clientSet.delete(id));
          }
        }

        const changedClients = added.concat(updated, removed);
        const update = awarenessProtocol.encodeAwarenessUpdate(
          this.awareness,
          changedClients
        );

        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(encoder, update);
        const message = encoding.toUint8Array(encoder);

        this.broadcast(message, origin instanceof WebSocket ? origin : undefined);

        // Fan-out awareness to Redis if originated locally
        if (origin !== "redis") {
          redisManager.publishAwarenessUpdate(this.roomId, update);
        }
      }
    );
  }

  public handleConnection(conn: WebSocket, payload: WsAuthTokenPayload) {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    const clientSet = new Set<number>();
    this.conns.set(conn, clientSet);

    // 1. Send SyncStep1 to newly connected client to start CRDT handshake
    const syncEncoder = encoding.createEncoder();
    encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(syncEncoder, this.doc);
    send(conn, encoding.toUint8Array(syncEncoder));

    // 2. Send current Awareness states to client
    const awarenessStates = this.awareness.getStates();
    if (awarenessStates.size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
      const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
        this.awareness,
        Array.from(awarenessStates.keys())
      );
      encoding.writeVarUint8Array(awarenessEncoder, awarenessUpdate);
      send(conn, encoding.toUint8Array(awarenessEncoder));
    }
  }

  public handleMessage(conn: WebSocket, message: Uint8Array) {
    try {
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case MESSAGE_SYNC: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, this.doc, conn);
          if (encoding.length(encoder) > 1) {
            send(conn, encoding.toUint8Array(encoder));
          }
          break;
        }
        case MESSAGE_AWARENESS: {
          const update = decoding.readVarUint8Array(decoder);
          awarenessProtocol.applyAwarenessUpdate(this.awareness, update, conn);
          break;
        }
        case MESSAGE_QUERY_AWARENESS: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
          const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
            this.awareness,
            Array.from(this.awareness.getStates().keys())
          );
          encoding.writeVarUint8Array(encoder, awarenessUpdate);
          send(conn, encoding.toUint8Array(encoder));
          break;
        }
        default:
          console.warn(`[Room ${this.roomId}] Unknown message type: ${messageType}`);
      }
    } catch (err) {
      console.error(`[Room ${this.roomId}] Error handling message:`, err);
    }
  }

  public handleDisconnect(conn: WebSocket) {
    const clientIds = this.conns.get(conn);
    if (clientIds && clientIds.size > 0) {
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        Array.from(clientIds),
        null
      );
    }

    this.conns.delete(conn);

    // If no clients left in the room, schedule cleanup after 30 seconds
    if (this.conns.size === 0) {
      this.scheduleCleanup();
    }
  }

  private scheduleCleanup() {
    if (this.cleanupTimer) clearTimeout(this.cleanupTimer);

    this.cleanupTimer = setTimeout(() => {
      if (this.conns.size === 0) {
        console.log(`[Room ${this.roomId}] Room empty. Cleaning up in-memory instance.`);
        redisManager.unsubscribeFromRoom(this.roomId);
        this.doc.destroy();
        this.onDestroyCallback?.(this.roomId);
      }
    }, 30000); // 30s grace period
  }

  public broadcast(message: Uint8Array, excludeConn?: WebSocket) {
    for (const [conn] of this.conns) {
      if (conn !== excludeConn && conn.readyState === WebSocket.OPEN) {
        send(conn, message);
      }
    }
  }

  public get connectionCount(): number {
    return this.conns.size;
  }
}
