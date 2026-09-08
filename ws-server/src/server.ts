import http from "http";
import { URL } from "url";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";
import { validateWsToken } from "./auth";
import { CollaborativeRoom } from "./room";
import { SERVER_ID } from "./redis";

// Load environment variables from .env / .env.local if available
dotenv.config();

const PORT = parseInt(process.env.PORT || process.env.WS_PORT || "1234", 10);
const HOST = process.env.HOST || "0.0.0.0";

const rooms = new Map<string, CollaborativeRoom>();

function getOrCreateRoom(roomId: string): CollaborativeRoom {
  let room = rooms.get(roomId);
  if (!room) {
    room = new CollaborativeRoom(roomId, (closedRoomId) => {
      rooms.delete(closedRoomId);
    });
    rooms.set(roomId, room);
    console.log(`[Server] Created room instance: ${roomId} (Total active: ${rooms.size})`);
  }
  return room;
}

// Create HTTP server for health checks & WebSocket upgrades
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (parsedUrl.pathname === "/health" || parsedUrl.pathname === "/") {
    let totalConnections = 0;
    for (const room of rooms.values()) {
      totalConnections += room.connectionCount;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        nodeId: SERVER_ID,
        activeRooms: rooms.size,
        totalConnections,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket upgrade and JWT verification
server.on("upgrade", (req, socket, head) => {
  try {
    const parsedUrl = new URL(
      req.url || "/",
      `http://${req.headers.host || "localhost"}`
    );

    // Extract requested room ID from pathname (e.g. "/my-project-123" -> "my-project-123")
    const pathname = parsedUrl.pathname.replace(/^\/+/, "");
    const requestedRoomId = pathname.split("/")[0] || "";

    // Extract token from query params or auth param
    const token =
      parsedUrl.searchParams.get("token") ||
      parsedUrl.searchParams.get("auth") ||
      (req.headers["sec-websocket-protocol"] as string | undefined);

    // Validate JWT token without querying PostgreSQL (Invariant 2)
    const authResult = validateWsToken(token, requestedRoomId);

    if (!authResult.valid || !authResult.payload) {
      console.warn(
        `[Security] Rejected WS upgrade for room '${requestedRoomId}': ${authResult.error} (Status: ${authResult.statusCode})`
      );
      socket.write(
        `HTTP/1.1 ${authResult.statusCode === 4403 ? 403 : 401} Unauthorized\r\n` +
          `Content-Type: text/plain\r\n` +
          `Connection: close\r\n\r\n` +
          `${authResult.error || "Unauthorized"}\n`
      );
      socket.destroy();
      return;
    }

    // Handshake approved -> complete upgrade
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, requestedRoomId, authResult.payload!);
    });
  } catch (err: any) {
    console.error("[Server] Error handling upgrade:", err);
    socket.destroy();
  }
});

// Setup room connection
wss.on(
  "connection",
  (ws: WebSocket, req: http.IncomingMessage, roomId: string, payload: any) => {
    console.log(
      `[Server] Client connected: user '${payload.userMeta?.name || payload.sub}' (${payload.role}) in room '${roomId}'`
    );

    const room = getOrCreateRoom(roomId);
    room.handleConnection(ws, payload);

    ws.on("message", (data: any) => {
      const uint8 = new Uint8Array(
        data instanceof ArrayBuffer
          ? data
          : Buffer.isBuffer(data)
          ? data
          : Buffer.from(data)
      );
      room.handleMessage(ws, uint8);
    });

    ws.on("close", (code, reason) => {
      console.log(
        `[Server] Client disconnected from room '${roomId}' (Code: ${code}, Reason: ${reason || "none"})`
      );
      room.handleDisconnect(ws);
    });

    ws.on("error", (err) => {
      console.warn(`[Server] Socket error in room '${roomId}':`, err.message);
      room.handleDisconnect(ws);
    });
  }
);

// Start server
server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(` Collaborative Yjs WebSocket Server Running`);
  console.log(` Node ID:    ${SERVER_ID}`);
  console.log(` Listening:  ws://${HOST}:${PORT}`);
  console.log(` Health:     http://${HOST}:${PORT}/health`);
  console.log(`====================================================`);
});

// Graceful shutdown
function shutdown() {
  console.log("[Server] Shutting down WebSocket server...");
  server.close(() => {
    console.log("[Server] HTTP & WebSocket server closed.");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
