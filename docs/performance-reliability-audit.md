# Collaborator AI: Performance Audit & Reliability Hardening Report

**Date:** October 20, 2026  
**Auditors:** Antigravity AI Engineering  
**Scope:** Review of October 20, 2026 Benchmark Report, WebSocket Server (`ws-server/`), Next.js Web APIs (`app/api/`), Yjs CRDT Collaboration Engine, Database Architecture (`lib/prisma.ts`), and Trigger.dev AI Design Agent.

---

## 1. Executive Summary

This audit evaluated the methodology, findings, and runtime characteristics of Collaborator AI's real-time collaboration and AI workflow infrastructure. 

While the core CRDT collaboration layer demonstrates **exceptional sub-millisecond in-memory performance (0.24ms RTT)** and robust room isolation, the audit identified **two critical reliability and durability issues** in room chat, a **confirmed redundant network call** in API authorization, and **distinct benchmark limitations** in the baseline metrics.

---

## 2. Confirmed Bottlenecks

### B1. Dual-Path Chat Race Condition & Database P2002 Collision
* **Location:** [`hooks/useRoomChat.ts`](file:///c:/Users/rohit/Desktop/Collaborator_AI/hooks/useRoomChat.ts#L193-L220) and [`ws-server/src/room.ts`](file:///c:/Users/rohit/Desktop/Collaborator_AI/ws-server/src/room.ts#L269-L293)
* **Diagnosis:**
  1. The client sends a chat message via HTTP `POST /api/projects/[projectId]/messages`. Next.js writes the record to PostgreSQL with a generated `created.id` and broadcasts via Redis.
  2. In `useRoomChat.ts`, after receiving the `confirmedMsg`, it *also* calls `sendWsChatMessage(provider, cleanContent, confirmedMsg.id)` over WebSocket.
  3. The WebSocket server receives `MESSAGE_CHAT = 4` with `confirmedMsg.id`, re-broadcasts locally, re-publishes to Redis, and executes `prisma.chatMessage.create({ data: { id: confirmedMsg.id, ... } })`.
  4. Because `id` is the Primary Key in PostgreSQL, this triggers an unhandled `P2002 Unique constraint failed` error on every message, logged as a warning.
  5. The dual submission causes Redis to publish every message twice, wasting bandwidth and triggering redundant client handler invocations.

### B2. Asynchronous Fire-and-Forget "Ghost Message" Risk
* **Location:** [`ws-server/src/room.ts`](file:///c:/Users/rohit/Desktop/Collaborator_AI/ws-server/src/room.ts#L269-L293)
* **Diagnosis:**
  1. If a message is submitted directly over WebSocket, `room.ts` broadcasts the message to all connected clients in the room *immediately* and calls `prisma.chatMessage.create(...).catch(...)` in the background.
  2. If PostgreSQL experiences a transient connection timeout, pool exhaustion, or constraint failure, the in-flight broadcast has already succeeded. All active peers see the message in their UI.
  3. However, the message was never durably written to PostgreSQL.
  4. When any user refreshes their browser (`F5`) or reconnects, `GET /api/projects/[projectId]/messages` reads from the database. The message is completely lost from history with zero notice to the sender.

### B3. Redundant Sequential Clerk HTTPS Round-Trip in Messages API
* **Location:** [`app/api/projects/[projectId]/messages/route.ts`](file:///c:/Users/rohit/Desktop/Collaborator_AI/app/api/projects/%5BprojectId%5D/messages/route.ts#L49-L162)
* **Diagnosis:**
  1. `POST /api/projects/[projectId]/messages` calls `await getProjectAccess(cleanProjectId)`. Inside `lib/project-access.ts`, `getCurrentUserIdentity()` calls `await currentUser()`.
  2. On line 154, the route handler calls `const clerkUser = await currentUser();` a second time to extract display name and emails.
  3. Each `currentUser()` call makes an external HTTPS request to `api.clerk.com`. Calling it twice adds ~100–180ms of unnecessary sequential network latency to every chat message sent via HTTP.

### B4. Geographic WAN Database Latency (~259ms)
* **Location:** Remote Prisma Postgres Pooler (`pooled.db.prisma.io:5432`)
* **Diagnosis:**
  1. The database server is geographically hosted in a US/EU cloud region, while tests ran from India (IST).
  2. The ~259ms query latency is almost entirely network ping / TLS round-trip time across the internet rather than PostgreSQL query engine execution (which is < 1ms for indexed lookups).
  3. Invariant 2 (no DB queries in the WebSocket upgrade/hot loop) successfully shielded real-time canvas collaboration from this WAN latency.

---

## 3. Benchmark Limitations in Baseline Report

1. **Development Mode vs Production Server**: The baseline web benchmarks were executed against `next dev`, which dynamically compiles routes JIT, inflating SSR response times to ~184ms and capping throughput at ~6.9 req/sec. Production builds with statically optimized chunks and caching will yield drastically higher throughput.
2. **Local Loopback WebSocket RTT**: The 0.24ms CRDT RTT represents local TCP loopback (`localhost:1234`). In production over the public internet, real-time latency will be governed by the user's network ping to the WebSocket host (typically 15–60ms).
3. **Small Sample Sizes**: The baseline report recorded 1 sample for the AI planner and 3 for task triggers. A statistically meaningful performance profile requires multiple warm-up runs and larger sample sizes.

---

## 4. Prioritized Action Plan

| Priority | Issue | Action | Risk | Impact |
| :---: | :--- | :--- | :---: | :---: |
| **P1** | **Chat Durability & Duplicate Suppression** | Unify chat submission through an authoritative path with client-generated stable IDs, eliminate redundant WS re-send on confirmed HTTP post, and ensure idempotent DB upsert. | Low | **High** (Eliminates P2002 errors, prevents lost messages, stops duplicate Redis events) |
| **P2** | **Redundant Clerk API Round-Trip** | Reuse user profile data from `getProjectAccess` instead of making a duplicate `await currentUser()` call in `POST /api/projects/[projectId]/messages`. | Low | **High** (Cuts ~120ms off chat HTTP latency) |
| **P3** | **Database Latency Diagnostic** | Instrument connection acquisition vs query execution time in benchmark suite to provide actionable infrastructure metrics. | None | **Medium** (Separates WAN ping from query cost) |
| **P4** | **Production-Mode Benchmarking** | Create automated scripts to benchmark against `next start` (production) with expanded AI and Trigger sample distributions. | Low | **High** (Accurate production baseline) |
| **P5** | **Prisma Connection Pooling** | Ensure Prisma client singleton is preserved on `globalThis` in all environments to prevent pool churn. | Low | **Medium** (Prevents connection leaks) |
