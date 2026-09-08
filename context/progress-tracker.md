# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Phase 3: Project APIs & Editor Wiring

## Current Goal

- Replace canvas placeholder with collaborative React Flow canvas (11-base-canvas.md)

## Completed

- 10-Yjs-setup.md: Established the real-time CRDT collaboration infrastructure with Yjs, y-websocket, Room JWTs, and Redis Pub/Sub WebSocket infrastructure.
  - Created `types/collaboration.ts` for ephemeral presence (`UserPresence`, `UserMeta`, `AwarenessState`) and auth payloads (`WsAuthTokenPayload`, `WsAuthResponse`).
  - Created `lib/collaboration-color.ts` implementing a 10-color deterministic hash palette for consistent cursor colors with zero database queries.
  - Created `lib/room-jwt.ts` with HS256 short-lived Room JWT token signing and verification (`signRoomToken`, `verifyRoomToken`).
  - Built `app/api/ws-auth/route.ts` enforcing Clerk authentication, Prisma project/collaborator access control, 1:1 room ID mapping, and short-lived Room JWT issuance.
  - Implemented standalone WebSocket server (`ws-server/`) with HTTP health check (`/health`), upgrade JWT verification without PostgreSQL querying, binary `y-websocket` CRDT synchronization, ephemeral awareness broadcasting, Redis Pub/Sub multi-instance fan-out, and active-room delta cache.
  - Built client lifecycle hook `hooks/useYjsRoom.ts` with Y.Doc map bindings (`nodes`, `edges`), awareness presence helpers, automatic re-authorization on disconnect, and 403 unauthorized loop termination.
  - Preserved all 5 core collaboration invariants and verified zero `@liveblocks/*` SDK references in the codebase.
- 09-share-dialog.md: Implemented project sharing APIs (`GET /api/projects/[projectId]/collaborators`, `POST /api/projects/[projectId]/collaborators`, `DELETE /api/projects/[projectId]/collaborators/[collaboratorId]`) with strict server-side owner authorization, Clerk Backend API user enrichment (display names and avatar images), and self-invite/duplicate invitation guards. Created `components/editor/dialogs/share-dialog.tsx` featuring owner invite controls, collaborator list with Clerk avatars and badges, read-only permissions for collaborators, and one-click project link copying with live `Copied!` feedback. Wired Share dialog into `components/editor/workspace-shell.tsx`.
- 08-editor-workspace-shell.md: Built the `/editor/[roomId]` workspace shell as a server component with server-side access verification via `lib/project-access.ts` (`getCurrentUserIdentity`, `getProjectAccess`). Unauthenticated requests redirect to `/sign-in`, while non-existent or unauthorized projects render `components/editor/access-denied.tsx`. Implemented full-viewport layout `components/editor/workspace-shell.tsx` with dynamic project name in top navbar, share action placeholder, AI chat toggle, left `ProjectSidebar` integration with active room highlighting (`currentRoomId`), center dark-themed canvas placeholder, and collapsible right AI sidebar placeholder.
- 07-wire-editor-home.md: Wired Editor Home server component, project sidebar, and project management dialogs to the real backend Project API. Implemented `lib/projects.ts` data access helper for server-side fetching of owned and shared projects (with zero initial client fetching), centralized dialog/mutation state in `hooks/useProjectActions.ts`, ensured 1:1 Yjs room ID alignment (`slug-suffix`) on creation with live preview, wired sidebar project navigation and action controls, and confirmed zero `@liveblocks/*` SDK references.
- 06-project-apis.md: Built backend project REST API routes in App Router: `GET /api/projects` (list user's owned projects), `POST /api/projects` (create with default name fallback, custom roomId support, and cuid ID strategy), `PATCH /api/projects/[projectId]` (rename project with 401 unauthenticated and 403 non-owner checks), and `DELETE /api/projects/[projectId]` (delete project with 401 unauthenticated and 403 non-owner checks).
- 05-prisma.md: Added Prisma project models (`Project`, `ProjectCollaborator`, `ProjectStatus` enum) in `prisma/models/project.prisma`, implemented cached singleton in `lib/prisma.ts` with connection branching (`DATABASE_URL` for `prisma+postgres://` via Accelerate vs `@prisma/adapter-pg`), generated Prisma 7 client to `app/generated/prisma`, and applied the initial migration `20260907134825_init` to the database.
- 04-project-dialogs.md: Implemented minimal centered Editor Home screen, dedicated `useProjectDialogs` hook, Create Project dialog with live slug preview, Rename Project dialog with prefilled auto-focusing input and Enter-to-submit, Delete Project dialog with destructive confirmation, and sidebar project list with actions for owned projects and mobile backdrop scrim.
- 03-auth.md: Authentication setup with Clerk.
- 02-editor-chrome.md: Base editor navbar and project sidebar shell.
- 01-design-system.md: Installed and configured shadcn/ui with Radix UI and Nova preset, added 7 UI primitives (Button, Card, Dialog, Input, Tabs, Textarea, ScrollArea), installed lucide-react, created lib/utils.ts with cn() helper, configured globals.css with complete dark-only design tokens and Tailwind v4 utilities.

## In Progress

- None

## Next Up

- 11-base-canvas.md: Base collaborative React Flow canvas with Yjs-synced nodes and edges

## Open Questions

- None.

## Architecture Decisions

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
