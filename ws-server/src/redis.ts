import Redis from "ioredis";
import crypto from "crypto";

export const SERVER_ID = `ws_srv_${crypto.randomUUID()}`;

export interface RedisMessage {
  serverId: string;
  roomId: string;
  type: "doc-update" | "awareness";
  payload: string; // base64 encoded binary
  timestamp: number;
}

export class RedisPubSubManager {
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private isConnected = false;
  private roomCallbacks = new Map<
    string,
    {
      onDocUpdate: (update: Uint8Array) => void;
      onAwarenessUpdate: (update: Uint8Array) => void;
    }
  >();

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.initRedis(redisUrl);
    } else {
      console.log(
        "[Redis] No REDIS_URL provided. Running in single-instance in-memory mode."
      );
    }
  }

  private initRedis(redisUrl: string) {
    try {
      this.pubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 10) return null; // stop retrying after 10 attempts
          return Math.min(times * 200, 3000);
        },
      });

      this.subClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 10) return null;
          return Math.min(times * 200, 3000);
        },
      });

      this.pubClient.on("connect", () => {
        this.isConnected = true;
        console.log(`[Redis] Publisher connected (Node ID: ${SERVER_ID})`);
      });

      this.pubClient.on("error", (err) => {
        console.warn("[Redis] Publisher connection warning:", err.message);
      });

      this.subClient.on("connect", () => {
        console.log(`[Redis] Subscriber connected (Node ID: ${SERVER_ID})`);
        this.setupSubscriber();
      });

      this.subClient.on("error", (err) => {
        console.warn("[Redis] Subscriber connection warning:", err.message);
      });
    } catch (err) {
      console.warn(
        "[Redis] Failed to initialize Redis. Running in standalone mode.",
        err
      );
    }
  }

  private setupSubscriber() {
    if (!this.subClient) return;

    this.subClient.on("message", (channel, messageStr) => {
      try {
        const msg = JSON.parse(messageStr) as RedisMessage;

        // Ignore messages published by this exact server instance to avoid echoing
        if (msg.serverId === SERVER_ID) return;

        const callbacks = this.roomCallbacks.get(msg.roomId);
        if (!callbacks) return;

        const binaryPayload = new Uint8Array(Buffer.from(msg.payload, "base64"));

        if (msg.type === "doc-update") {
          callbacks.onDocUpdate(binaryPayload);
        } else if (msg.type === "awareness") {
          callbacks.onAwarenessUpdate(binaryPayload);
        }
      } catch (err) {
        console.error("[Redis] Error parsing pubsub message:", err);
      }
    });
  }

  /**
   * Subscribes to Redis channels for a specific Yjs room.
   */
  public async subscribeToRoom(
    roomId: string,
    onDocUpdate: (update: Uint8Array) => void,
    onAwarenessUpdate: (update: Uint8Array) => void
  ) {
    this.roomCallbacks.set(roomId, { onDocUpdate, onAwarenessUpdate });

    if (this.subClient && this.isConnected) {
      try {
        await this.subClient.subscribe(`yjs:room:${roomId}`);
      } catch (err) {
        console.warn(`[Redis] Failed to subscribe to room ${roomId}:`, err);
      }
    }
  }

  /**
   * Unsubscribes from Redis channels for a room when closed.
   */
  public async unsubscribeFromRoom(roomId: string) {
    this.roomCallbacks.delete(roomId);

    if (this.subClient && this.isConnected) {
      try {
        await this.subClient.unsubscribe(`yjs:room:${roomId}`);
      } catch (err) {
        console.warn(`[Redis] Failed to unsubscribe from room ${roomId}:`, err);
      }
    }
  }

  /**
   * Publishes a document CRDT update to other WebSocket instances.
   */
  public async publishDocUpdate(roomId: string, update: Uint8Array) {
    if (!this.pubClient || !this.isConnected) return;

    const base64Update = Buffer.from(update).toString("base64");
    const msg: RedisMessage = {
      serverId: SERVER_ID,
      roomId,
      type: "doc-update",
      payload: base64Update,
      timestamp: Date.now(),
    };

    try {
      await this.pubClient.publish(`yjs:room:${roomId}`, JSON.stringify(msg));
      // Save active room delta / snapshot to Redis cache (24h TTL)
      await this.pubClient.set(
        `yjs:cache:${roomId}`,
        base64Update,
        "EX",
        24 * 60 * 60
      );
    } catch (err) {
      console.warn(`[Redis] Failed to publish doc update for ${roomId}:`, err);
    }
  }

  /**
   * Publishes an ephemeral Awareness update to other WebSocket instances.
   */
  public async publishAwarenessUpdate(roomId: string, update: Uint8Array) {
    if (!this.pubClient || !this.isConnected) return;

    const msg: RedisMessage = {
      serverId: SERVER_ID,
      roomId,
      type: "awareness",
      payload: Buffer.from(update).toString("base64"),
      timestamp: Date.now(),
    };

    try {
      await this.pubClient.publish(`yjs:room:${roomId}`, JSON.stringify(msg));
    } catch (err) {
      console.warn(`[Redis] Failed to publish awareness for ${roomId}:`, err);
    }
  }

  /**
   * Loads cached active room state from Redis when a room initializes.
   */
  public async getCachedDocState(roomId: string): Promise<Uint8Array | null> {
    if (!this.pubClient || !this.isConnected) return null;

    try {
      const cached = await this.pubClient.get(`yjs:cache:${roomId}`);
      if (cached) {
        return new Uint8Array(Buffer.from(cached, "base64"));
      }
    } catch (err) {
      console.warn(`[Redis] Failed to get cached state for ${roomId}:`, err);
    }
    return null;
  }
}

export const redisManager = new RedisPubSubManager();
