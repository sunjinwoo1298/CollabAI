import WebSocket from "ws";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { signRoomToken } from "@/lib/room-jwt";
import { prisma } from "@/lib/prisma";
import { get, put } from "@vercel/blob";
import { CanvasNode, CanvasEdge } from "@/types/canvas";

export interface RoomClientOptions {
  projectId: string;
  roomId: string;
  runId?: string;
  wsUrl?: string;
  connectTimeoutMs?: number;
}

export interface AiAwarenessPayload {
  isThinking: boolean;
  thinking?: boolean;
  cursor?: { x: number; y: number } | null;
  statusMessage?: string;
  text?: string;
  runId?: string;
  projectId?: string;
  status?: string;
  timestamp?: number;
}

export class YjsRoomClient {
  public readonly doc: Y.Doc;
  public readonly nodesMap: Y.Map<any>;
  public readonly edgesMap: Y.Map<any>;
  public readonly projectId: string;
  public readonly roomId: string;
  public readonly runId?: string;

  private provider: WebsocketProvider | null = null;
  private isWsConnected = false;
  private wsUrl: string;

  constructor(options: RoomClientOptions) {
    this.projectId = options.projectId;
    this.roomId = options.roomId;
    this.runId = options.runId;
    this.wsUrl =
      options.wsUrl ||
      process.env.WS_URL ||
      process.env.NEXT_PUBLIC_WS_URL ||
      "ws://localhost:1234";

    this.doc = new Y.Doc();
    this.nodesMap = this.doc.getMap("nodes");
    this.edgesMap = this.doc.getMap("edges");
  }

  /**
   * Connects to the collaborative Yjs room.
   * Joins as an ephemeral 'ai-agent' peer over WebSocket so presence and CRDT updates
   * broadcast to all connected human clients in real time.
   * If WebSocket is unreachable, falls back to loading persistent snapshot from PostgreSQL/Blob.
   */
  public async connect(timeoutMs = 3000): Promise<boolean> {
    const token = signRoomToken({
      sub: "ai-agent",
      projectId: this.projectId,
      roomId: this.roomId,
      role: "collaborator",
      userMeta: {
        userId: "ai-agent",
        name: "AI Architect",
        avatar: "",
        color: "#8B5CF6",
      },
    });

    try {
      this.provider = new WebsocketProvider(this.wsUrl, this.roomId, this.doc, {
        WebSocketPolyfill: WebSocket as any,
        params: { token },
        connect: true,
      });

      // Initialize AI identity in Yjs awareness
      if (this.provider.awareness) {
        this.provider.awareness.setLocalStateField("user", {
          userId: "ai-agent",
          name: "AI Architect",
          avatar: "",
          color: "#8B5CF6",
        });
        this.provider.awareness.setLocalStateField("presence", {
          cursor: null,
          isThinking: true,
          thinking: true,
          statusMessage: "AI is starting...",
          text: "AI is starting...",
          runId: this.runId,
          projectId: this.projectId,
          status: "starting",
          timestamp: Date.now(),
        });
      }

      // Wait for CRDT sync with room
      await new Promise<void>((resolve) => {
        let isDone = false;
        const timer = setTimeout(() => {
          if (!isDone) {
            isDone = true;
            resolve();
          }
        }, timeoutMs);

        this.provider?.on("sync", (synced: boolean) => {
          if (synced && !isDone) {
            isDone = true;
            this.isWsConnected = true;
            clearTimeout(timer);
            resolve();
          }
        });
      });
    } catch (err) {
      console.warn(
        `[YjsRoomClient] Could not connect to WebSocket at ${this.wsUrl}:`,
        (err as any)?.message
      );
    }

    // If WebSocket was not connected or room is empty, check if Blob snapshot exists
    if (!this.isWsConnected || (this.nodesMap.size === 0 && this.edgesMap.size === 0)) {
      await this.loadDurableSnapshotFallback();
    }

    return this.isWsConnected;
  }

  /**
   * Updates ephemeral AI thinking and cursor position across Yjs Awareness.
   */
  public setAiAwareness(presence: AiAwarenessPayload) {
    if (!this.provider?.awareness) return;

    this.provider.awareness.setLocalStateField("user", {
      userId: "ai-agent",
      name: "AI Architect",
      avatar: "",
      color: "#8B5CF6",
    });

    const isThinkingVal =
      presence.thinking !== undefined
        ? presence.thinking === true
        : presence.isThinking === true;
    const statusText = presence.text || presence.statusMessage;

    this.provider.awareness.setLocalStateField("presence", {
      isThinking: isThinkingVal,
      thinking: isThinkingVal,
      cursor: presence.cursor || null,
      statusMessage: statusText,
      text: statusText,
      runId: presence.runId || this.runId,
      projectId: presence.projectId || this.projectId,
      status: presence.status || (isThinkingVal ? "planning" : "completed"),
      timestamp: presence.timestamp || Date.now(),
    });
  }

  /**
   * Cleans up AI presence and terminates room connection.
   */
  public async disconnect(): Promise<void> {
    if (this.provider?.awareness) {
      try {
        this.provider.awareness.setLocalStateField("presence", {
          isThinking: false,
          thinking: false,
          cursor: null,
          statusMessage: undefined,
          text: undefined,
          runId: this.runId,
          projectId: this.projectId,
          status: "completed",
          timestamp: Date.now(),
        });
      } catch (e) {
        // ignore
      }
    }

    // If WebSocket was NOT connected, persist the updated canvas directly to Vercel Blob
    if (!this.isWsConnected) {
      await this.persistSnapshotFallback();
    }

    // Allow short delay for final Yjs frames to flush
    await new Promise((r) => setTimeout(r, 100));

    try {
      this.provider?.destroy();
      this.doc.destroy();
    } catch (e) {
      // ignore
    }
  }

  public get isConnected(): boolean {
    return this.isWsConnected;
  }

  /**
   * Offline/Cold-start Fallback: Loads snapshot from Vercel Blob / PostgreSQL
   * when WebSocket server is not running or room has not yet loaded state.
   */
  private async loadDurableSnapshotFallback(): Promise<void> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: this.projectId },
        select: { canvasJsonPath: true },
      });

      if (!project?.canvasJsonPath) return;

      const blobResult = await get(project.canvasJsonPath, {
        access: "private",
        token: process.env.BLOB_READ_WRITE_TOKEN,
        useCache: false,
      });

      if (!blobResult || !blobResult.stream) return;
      const data: any = await new Response(blobResult.stream).json();

      if (this.nodesMap.size === 0 && Array.isArray(data.nodes) && data.nodes.length > 0) {
        this.doc.transact(() => {
          for (const node of data.nodes) {
            this.nodesMap.set(node.id, node);
          }
          for (const edge of data.edges || []) {
            this.edgesMap.set(edge.id, edge);
          }
        }, "blob-restore");
      }
    } catch (err) {
      // Ignore fallback errors
    }
  }

  /**
   * Offline Fallback: Persists canvas to Vercel Blob if no live WebSocket peer was reachable.
   */
  private async persistSnapshotFallback(): Promise<void> {
    if (this.nodesMap.size === 0 && this.edgesMap.size === 0) return;
    if (!process.env.BLOB_READ_WRITE_TOKEN) return;

    try {
      const serialized = JSON.stringify({
        nodes: Array.from(this.nodesMap.values()),
        edges: Array.from(this.edgesMap.values()),
      });

      const blobPath = `canvas/${this.projectId}.json`;
      const blob = await put(blobPath, serialized, {
        access: "private",
        token: process.env.BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });

      await prisma.project.update({
        where: { id: this.projectId },
        data: { canvasJsonPath: blob.url },
      });
    } catch (err) {
      // Ignore fallback save error
    }
  }
}
