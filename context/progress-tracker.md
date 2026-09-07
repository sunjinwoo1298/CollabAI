# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Phase 2: Prisma & Database Setup

## Current Goal

- Implement Prisma data layer & project models (05-prisma.md)

## Completed

- 05-prisma.md: Added Prisma project models (`Project`, `ProjectCollaborator`, `ProjectStatus` enum) in `prisma/models/project.prisma`, implemented cached singleton in `lib/prisma.ts` with connection branching (`DATABASE_URL` for `prisma+postgres://` via Accelerate vs `@prisma/adapter-pg`), generated Prisma 7 client to `app/generated/prisma`, and applied the initial migration `20260907134825_init` to the database.
- 04-project-dialogs.md: Implemented minimal centered Editor Home screen, dedicated `useProjectDialogs` hook, Create Project dialog with live slug preview, Rename Project dialog with prefilled auto-focusing input and Enter-to-submit, Delete Project dialog with destructive confirmation, and sidebar project list with actions for owned projects and mobile backdrop scrim.
- 03-auth.md: Authentication setup with Clerk.
- 02-editor-chrome.md: Base editor navbar and project sidebar shell.
- 01-design-system.md: Installed and configured shadcn/ui with Radix UI and Nova preset, added 7 UI primitives (Button, Card, Dialog, Input, Tabs, Textarea, ScrollArea), installed lucide-react, created lib/utils.ts with cn() helper, configured globals.css with complete dark-only design tokens and Tailwind v4 utilities.

## In Progress

- None

## Next Up

- 06-project-apis.md: Project API routes (list, create, rename, delete)

## Open Questions

- None.

## Architecture Decisions

- Configured dark-only design tokens via CSS variables and Tailwind v4 @theme inline mappings to align shadcn primitives and custom tokens.
- Preserved pristine generated files in components/ui/*.
- Extracted dialog and form state management into `hooks/use-project-dialogs.ts` for clean separation between UI components and action handling.
- Sidebar action controls (rename/delete) are exclusively rendered for owned projects and hidden for shared projects.
- Database layer uses Prisma 7 multi-file schema configuration (`schema: "prisma/"` in `prisma7.config.ts`), generating to `app/generated/prisma`.
- `lib/prisma.ts` provides a runtime singleton that branches dynamically: using `accelerateUrl` for `prisma+postgres://` URLs and `@prisma/adapter-pg` pool adapter for standard PostgreSQL connection strings, cached on `globalThis` in development.

## Session Notes

- Completed 05-prisma.md. Created `prisma/models/project.prisma`, created `lib/prisma.ts` singleton with dynamic adapter/accelerate branching, applied migration `20260907134825_init`, generated client, and verified `npm run build` passes with zero errors.
