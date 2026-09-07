# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Phase 3: Project APIs & Editor Wiring

## Current Goal

- Build `/editor/[roomId]` workspace shell with access checks (08-editor-workspace-shell.md)

## Completed

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

- 08-editor-workspace-shell.md: Build the `/editor/[roomId]` workspace shell with server-side access checks and access denied handling

## Open Questions

- None.

## Architecture Decisions

- Configured dark-only design tokens via CSS variables and Tailwind v4 @theme inline mappings to align shadcn primitives and custom tokens.
- Preserved pristine generated files in components/ui/*.
- Extracted dialog and form state management into `hooks/useProjectActions.ts` (with backwards-compatible aliases in `hooks/use-project-dialogs.ts`) for clean separation between UI components and action handling.
- Server-side data fetching for `/editor` is performed in `app/editor/page.tsx` via `lib/projects.ts` (querying owned projects by Clerk `userId` and shared projects by user email addresses).
- Project creation generates a 1:1 aligned Yjs Room ID (`slugified-name-suffix`) that is saved directly as the project `id` in the database and navigated to `/editor/[id]`.
- Sidebar action controls (rename/delete) are exclusively rendered for owned projects and hidden for shared projects.
- Database layer uses Prisma 7 multi-file schema configuration (`schema: "prisma/"` in `prisma7.config.ts`), generating to `app/generated/prisma`.
- `lib/prisma.ts` provides a runtime singleton that branches dynamically: using `accelerateUrl` for `prisma+postgres://` URLs and `@prisma/adapter-pg` pool adapter for standard PostgreSQL connection strings, cached on `globalThis` in development.
- Backend project routes (`/api/projects` and `/api/projects/[projectId]`) enforce Clerk user authentication (`401` on unauthenticated) and strict owner authorization (`403` on non-owner rename or delete attempts).

## Session Notes

- Completed 07-wire-editor-home.md. Created `lib/projects.ts` for server-side project fetching and relative timestamp formatting. Created `hooks/useProjectActions.ts` handling dialog state, room ID generation, and mutation requests. Updated `app/api/projects/route.ts` to support custom Yjs room IDs. Converted `app/editor/page.tsx` into a Server Component with client boundary in `components/editor/editor-home-client.tsx`. Verified zero `@liveblocks/*` references and passed `npm run build` with zero errors.
