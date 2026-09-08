# Real-Time Collaboration Setup: Yjs + y-websocket + Custom WebSocket Infrastructure

## Goal

Implement the real-time collaboration infrastructure for Collab AI using:

- Yjs for CRDT-based collaborative state
- `y-websocket` for Yjs synchronization and Awareness transport
- A self-hosted custom WebSocket server
- Redis pub/sub for horizontal WebSocket server scaling
- Short-lived JWT room tokens for WebSocket authorization
- Automatic token re-authorization on reconnect
- Clerk + PostgreSQL membership validation through the Next.js API

---

# 1. Architecture

The collaboration architecture must follow this flow:

```text
                         ┌──────────────────────┐
                         │       Clerk          │
                         │ Authentication       │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Next.js API          │
                         │ POST /api/ws-auth    │
                         └──────────┬───────────┘
                                    │
                         Clerk auth + DB check
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Short-lived JWT      │
                         │ Room Token           │
                         └──────────┬───────────┘
                                    │
                                    ▼
Browser                    WebSocket Server
┌───────────────┐          ┌──────────────────────┐
│ React Flow    │          │ JWT verification     │
│               │          │ Room authorization   │
│ Y.Doc         │◄────────►│ y-websocket protocol │
│               │          │ Awareness            │
└───────────────┘          └──────────┬───────────┘
                                     │
                                Redis Pub/Sub
                                     │
                     ┌───────────────┴──────────────┐
                     ▼                              ▼
              WS Server A                    WS Server B
                     │                              │
                     └──────────────┬───────────────┘
                                    │
                                    ▼
                              Same Yjs Room