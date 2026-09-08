## Objective

Implement the base collaborative system-design canvas for Collab AI on top of the existing Feature 10 Yjs infrastructure.

The canvas must use **React Flow for rendering and interaction** and **Yjs as the single source of truth** for nodes and edges.

Do NOT introduce Liveblocks, a separate canvas state store, or a second persistence mechanism.

---

# 1. Existing Infrastructure

Feature 10 is already implemented.

The existing collaboration stack is:

```text
Next.js
   ↓
POST /api/ws-auth
   ↓
Short-lived Room JWT
   ↓
Y.Doc
   ↓
y-websocket
   ↓
Custom WebSocket Server
   ↓
Redis Pub/Sub

