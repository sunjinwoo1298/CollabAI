# Architecture Context

## Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| Framework | Next.js 16 + TypeScript | Full-stack app with server/client boundaries |
| UI | Tailwind + shadcn/ui | Component composition and styling |
| Auth | Clerk | User identity and route protection |
| Database | Prisma + PostgreSQL | Relational metadata: projects, collaborators, specs, task runs |
| Canvas | Yjs + custom WebSocket server + React Flow | Self-hosted real-time collaborative canvas, CRDT-based conflict resolution, custom presence protocol |
| Real-time infra | Node WS server + Redis pub/sub | Horizontally scalable room-based message relay |
| Background tasks | Trigger.dev | Durable AI generation workflows |
| Artifact storage | Vercel Blob + Redis | Durable canvas snapshots, active delta logs, and generated Markdown specs |

## System Boundaries

- `app/api` — Authenticated request handlers: input validation, ownership checks, task triggering, and persistence.
- `trigger` — Long-running background jobs: AI design generation and spec generation.
- `lib` — Shared infrastructure: Prisma client, access control helpers, and utilities.
- `components` — UI composition: canvas surfaces, sidebars, dialogs, and interactive elements.
- `prisma` — Database schema and generated client output.
- `data` — Legacy local directory. Not used for new artifacts.
- `ws-server` — Standalone WebSocket server: room management, Yjs update relay, Redis-backed fan-out across instances, awareness broadcast, and delta caching.

## Storage Model

- **Database (PostgreSQL)**: Metadata, ownership, relationships, spec records, and task run records.
- **Redis**: High-frequency ephemeral binary Yjs updates (deltas) per active room to bridge connection cold-starts before snapshot flushes.
- **Vercel Blob**: Durable generated artifacts — baseline canvas snapshots at `canvas/{projectId}.json` and Markdown specs at `specs/{projectId}/{specId}.md`.
- Canvas content and Markdown output are stored in and retrieved from Vercel Blob.
- The blob URL is stored in the database (`canvasJsonPath`, `filePath`) as the reference to the artifact.

## Auth and Collaboration Model

- Every project has a single owner (Clerk user ID).
- Projects can include additional collaborators.
- Only authenticated users can access protected routes.
- Only the owner or a collaborator can mutate project resources.
- WebSocket connections to a project's room require a short-lived room token, issued by an authenticated Next.js API route only after verifying project membership (owner or collaborator).
- The room token is a signed, expiring credential (e.g. JWT) encoding userId, projectId, and role — the WS server verifies the signature and expiry itself, without querying Postgres on every connection.
- The WS server enforces the same membership check implicitly by trusting the signed token; it never re-derives permissions from raw client input.
- Token expiry forces periodic re-authorization: on reconnect (network drop, tab refresh, or expiry), the client re-requests a token from the API route, so membership changes (e.g. a removed collaborator) take effect on next reconnect rather than persisting for the life of a stale session.
- Removing a collaborator does not necessarily terminate their current WebSocket session immediately; it invalidates their ability to obtain a new token. Forcibly disconnecting an active session is a documented extension point (see Future Work) via a Redis-published "kick" message the WS server listens for per room.

## Starter System Designs

- Prebuilt templates are static canvas snapshots stored in the codebase.
- Templates are loaded into the active Yjs room when a user imports one.
- Import can occur on canvas creation or from within the editor at any time.
- Template data follows the same node/edge schema as user-created canvas content.
- Templates do not require a separate database record; they are resolved by template ID at import time.

## AI Generation Model

### Design Generation

- Input: user prompt, project context, and current canvas state.
- Execution: durable background task via Trigger.dev.
- Output: structured node and edge updates written into the shared Yjs room.

### AI-Generated Updates

- AI-generated node/edge changes are applied as Yjs document transactions, submitted through the same WebSocket path as human edits — the AI is not a special-cased writer, it participates in the same conflict-resolution system as any other client.
- Design generation output is schema-validated (strict node/edge type contract) before being converted into a Yjs transaction; invalid output is rejected before it reaches shared state.
- Extending an existing design is a diff against current graph state, applied as an incremental patch, not a full-document replace — this avoids clobbering concurrent human edits made while the background job was running.
- Generation runs as a durable Trigger.dev background task; the resulting transaction is idempotent (keyed by task run ID) so a retried job cannot double-apply.

### Spec Generation

- Input: current canvas graph and project context.
- Execution: durable background task via Trigger.dev.
- Output: Markdown technical spec saved to Vercel Blob and linked to the project in the database.

## Invariants

1. Request handlers do not run long-lived AI work — that belongs in background tasks.
2. Metadata and large generated artifacts are stored in separate layers.
3. Auth and ownership are enforced at every mutation boundary.
4. Client components are used only where browser interactivity or real-time state requires them.
5. The canvas schema must remain consistent between user-created content and imported templates.
6. All canvas mutations — human or AI-generated — flow through the Yjs document as CRDT transactions; no code path writes canvas state directly.
7. Presence/awareness state is never persisted and does not participate in conflict resolution.
8. WebSocket servers are stateless beyond in-memory room caches; Redis is the source of truth for cross-instance fan-out and uncompacted delta logs, Postgres/Blob for durable snapshots.
9. WebSocket authorization is enforced via short-lived signed tokens issued after a Postgres membership check; the WS server itself never queries the database directly.