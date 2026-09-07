# Project API Wiring: Editor Home, Sidebar, and Dialogs

## Goal
Wire the editor home page, sidebar, and workspace management dialogs to the real backend Project API. Replace legacy Liveblocks references with native **Yjs room ID** architecture.

---

## Technical Specifications & Requirements

### 1. Data Fetching (Server-Side)
- **Target Component:** Editor home page (`app/editor/page.tsx` or Server Component equivalent).
- **Requirements:**
  - Fetch both `ownedProjects` and `sharedProjects` server-side using the project data access helper.
  - Pass both lists as props directly to the sidebar component.
  - **Strict Requirement:** No client-side fetching (`useEffect`, `SWR`, or `React Query`) for initial page load.

---

### 2. `useProjectActions` Hook
- **File Location:** `hooks/useProjectActions.ts`
- **Role:** Centralize dialog state management and project API mutations.

#### State & Action Handlers

#### **Create Project**
- **State Managed:** `isCreateOpen` (boolean), `projectName` (string).
- **Execution Flow:**
  1. Take the user's `projectName` input.
  2. Slugify the name and generate a short unique suffix (e.g., `my-system-a1b2c`).
  3. Set the generated slug as the **Yjs room ID**.
  4. Send a request to `POST /api/projects` containing the project `name` and the derived `roomId`/`id`.
  5. On successful creation, navigate to the newly created workspace route (`/editor/[id]`).
- **Invariant:** The project ID and Yjs room ID must stay strictly 1:1 aligned.

#### **Rename Project**
- **State Managed:** `isRenameOpen` (boolean), `targetProject` (`{ id: string, name: string } | null`).
- **Execution Flow:**
  1. Store the targeted project's ID and current name.
  2. Send a request to `PATCH /api/projects/[id]` with the updated name.
  3. On success, close the dialog and call `router.refresh()`.

#### **Delete Project**
- **State Managed:** `isDeleteOpen` (boolean), `targetProject` (`{ id: string, name: string } | null`).
- **Execution Flow:**
  1. Store the targeted project details.
  2. Send a request to `DELETE /api/projects/[id]`.
  3. On success:
     - If the deleted project is the currently active workspace, redirect the user to `/editor`.
     - Otherwise, close the dialog and call `router.refresh()`.

---

### 3. Component & Dialog Wiring

- **Sidebar Component:**
  - Consumes `ownedProjects` and `sharedProjects` supplied by the server component.
  - Triggers Create, Rename, and Delete modals via `useProjectActions`.

- **Create Project Dialog:**
  - Shows a real-time preview of the calculated **Yjs Room ID** (slugified name + short suffix) as the user types.

- **Rename Project Dialog:**
  - Pre-fills the input field with `targetProject.name`.

- **Delete Project Dialog:**
  - Displays `targetProject.name` to confirm deletion.

---

## Definition of Done (Checklist)

- [ ] Sidebar renders real project data fetched on the server.
- [ ] Create project action creates the Yjs room alignment, saves to DB, and navigates to `/editor/[id]`.
- [ ] Rename project action calls `PATCH /api/projects/[id]` and updates state correctly.
- [ ] Delete project action calls `DELETE /api/projects/[id]` and handles redirecting or refreshing appropriately.
- [ ] All references to `@liveblocks/*` SDKs/hooks are completely removed.
- [ ] `npm run build` passes with zero TypeScript or routing errors.