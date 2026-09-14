# Implementation Plan — Collaborative Participants & Live Cursors

Show active room participants and their live cursors inside the existing collaborative editor canvas.

This feature must use the existing **Yjs + WebSocket + Awareness** collaboration infrastructure from Feature 10/11. Do **not** reintroduce or use Liveblocks.

---

## Requirements

### 1. Keep the Existing Navbar Unchanged

- Do not change the editor home navbar.
- Do not move or redesign the shared navbar globally.
- If the editor home and canvas use the same navbar component, presence UI must only be rendered inside the active canvas/editor room.
- Do not remove or modify existing navbar actions such as Save, Import, Share, or AI.
- Keep the existing Clerk `UserButton` behavior unchanged.

---

### 2. Add Active Participant Avatars to the Canvas

Add a participant group inside the **top-right corner of the collaborative canvas**, visually separate from the main navbar.

Use the existing Yjs Awareness state exposed by `useYjsRoom.ts` / `useCanvasSync.ts`.

Each awareness state already contains user metadata such as:

```ts
{
  user: {
    userId: string;
    name: string;
    avatar: string;
    color: string;
  },
  presence: {
    cursor: { x: number; y: number } | null;
    isThinking?: boolean;
  }
}