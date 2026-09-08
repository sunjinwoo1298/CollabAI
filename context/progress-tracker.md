# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Phase 3: Project APIs & Editor Wiring

## Current Goal

- Implement architecture starter templates (12-templates.md)

## Completed

- 11-base-canvas.md: Built base collaborative React Flow canvas using Yjs CRDT single source of truth (`nodesMap`, `edgesMap`).
  - Installed `@xyflow/react` and configured custom dark-glassmorphism theme styles in `app/globals.css`.
  - Created `types/canvas.ts` defining serializable node schemas (`SystemNodeData`, `CanvasNode`, `CanvasEdge`, `RemoteCollaborator`).
  - Built `components/canvas/nodes/system-node.tsx` with 8 system component archetypes (Service, Database, Cache, Queue, Gateway, Storage, Client, Custom), multi-port connection handles, and status indicators.
  - Built `components/canvas/cursors/collaborator-cursor.tsx` with `<ViewportPortal>` for pan/zoom invariant remote cursor and presence rendering, exact coordinate pointer tip, user deterministic colors, avatar badges, and animated `Thinking...` indicators.
  - Added throttled pointer awareness broadcasting (~30fps with requestAnimationFrame) in `components/canvas/collaborative-canvas.tsx` to prevent WebSocket flooding, with clean unmount and leave teardown.
  - Built `hooks/useCanvasSync.ts` implementing loop-free bidirectional Yjs <-> React Flow synchronization, safe initial hydration, optimistic local interactions, ephemeral Awareness peer tracking (excluding local user), and batch transactions (`doc.transact`).
  - Built `components/canvas/collaborative-canvas.tsx` featuring interactive top toolbar, quick component presets, click and drag-and-drop node placement (`onDragStart`, `onDragOver`, `onDrop`), fit view, connection indicator (`Live` / `Connecting...` / `Offline`), collaborator presence count, natural full-bleed dark dot grid background, controls, and minimap.
  - Resolved WebSocket reconnection loop in `hooks/useYjsRoom.ts` by ignoring null close events on local provider teardown, removing listener leaks, and adding re-entrancy guards.
  - Updated workspace layout in `components/editor/workspace-shell.tsx` and `components/editor/project-sidebar.tsx` so both sidebars float seamlessly over the infinite canvas without resizing the canvas or card-like margins.
  - Integrated canvas into `components/editor/workspace-shell.tsx` and created test suite `test/canvas-sync.test.ts`.
- 10-Yjs-setup.md: Established the real-time CRDT collaboration infrastructure with Yjs, y-websocket, Room JWTs, and Redis Pub/Sub WebSocket infrastructure.

- Configured dark-only design tokens via CSS variables and Tailwind v4 @theme inline mappings to align shadcn primitives and custom tokens.
- Preserved pristine generated files in components/ui/*.
- Extracted dialog and form state management into `hooks/useProjectActions.ts` (with backwards-compatible aliases in `hooks/use-project-dialogs.ts`) for clean separation between UI components and action handling.
- Server-side data fetching for `/editor` is performed in `app/editor/page.tsx` via `lib/projects.ts` (querying owned projects by Clerk `userId` and shared projects by user email addresses).
- Project creation generates a 1:1 aligned Yjs Room ID (`slugified-name-suffix`) that is saved directly as the project `id` in the database and navigated to `/editor/[id]`.
- Project workspace route `/editor/[roomId]` is a dynamic Server Component enforcing access control via `lib/project-access.ts` (verifying ownership against `ownerId` and collaboration against `ProjectCollaborator.email`).
- Missing or unauthorized projects render `components/editor/access-denied.tsx` with a return link to `/editor`.
- Full-viewport workspace shell (`components/editor/workspace-shell.tsx`) features full project sidebar integration with active room highlighting (`currentRoomId`), central dark canvas placeholder area, and collapsible right AI assistant panel.
- Project collaborator management uses REST endpoints under `/api/projects/[projectId]/collaborators` with Clerk Backend API profile enrichment (`clerkClient().users.getUserList({ emailAddress })`) and strict owner authorization on mutations.
- Collaborators are stored by email in PostgreSQL (`ProjectCollaborator` model) with zero local user table duplication.
- Sidebar action controls (rename/delete) are exclusively rendered for owned projects and hidden for shared projects.
- Database layer uses Prisma 7 multi-file schema configuration (`schema: "prisma/"` in `prisma7.config.ts`), generating to `app/generated/prisma`.
- `lib/prisma.ts` provides a runtime singleton that branches dynamically: using `accelerateUrl` for `prisma+postgres://` URLs and `@prisma/adapter-pg` pool adapter for standard PostgreSQL connection strings, cached on `globalThis` in development.
- Backend project routes (`/api/projects` and `/api/projects/[projectId]`) enforce Clerk user authentication (`401` on unauthenticated) and strict owner authorization (`403` on non-owner rename or delete attempts).
- Invariant 1 (One Project, One Yjs Room): Project ID strictly equals Yjs room ID (`project.id === yjs.roomId`). Client requests WebSocket authorization using only `{ projectId }`.
- Invariant 2 (No WS DB Queries): WebSocket server verifies short-lived HS256 Room JWTs cryptographically without querying PostgreSQL.
- Invariant 3 (All Canvas Mutations Use Yjs): Architecture graph state is exposed via Yjs top-level maps (`doc.getMap("nodes")`, `doc.getMap("edges")`).
- Invariant 4 (Awareness is Ephemeral): Cursor positions, isThinking flags, and user metadata are broadcast exclusively over Yjs Awareness and never persisted.
- Invariant 5 (Reconnection Requires Reauthorization): WebSocket reconnection automatically re-fetches a short-lived token via `POST /api/ws-auth`; HTTP 403 halts the reconnect loop.
- Cross-Instance Scaling: WebSocket server integrates Redis Pub/Sub for multi-instance message fan-out and active-room state recovery, with graceful in-memory fallback when Redis is absent.

## Session Notes

- Completed 10-Yjs-setup.md. Implemented Yjs and y-websocket real-time CRDT collaboration infrastructure: created `types/collaboration.ts`, `lib/collaboration-color.ts` (10-color deterministic hashing), `lib/room-jwt.ts`, `app/api/ws-auth/route.ts` (Clerk + Prisma membership auth and Room JWT issuance), standalone WebSocket server in `ws-server/` (JWT upgrade validation, y-websocket sync protocol, ephemeral awareness, Redis Pub/Sub cross-instance fan-out, delta cache), and `hooks/useYjsRoom.ts` (room lifecycle, token auth, reconnect re-authorization, 403 halt). Verified all 5 collaboration invariants, multi-client CRDT sync, awareness broadcasting, zero Liveblocks references, and successful `npm run build` compilation.
