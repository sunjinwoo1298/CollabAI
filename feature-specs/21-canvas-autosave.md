# Implementation Plan — Collaborative Canvas Autosave & Persistence

Add durable autosave and loading for the collaborative canvas before implementing AI canvas generation.

Use the existing **Yjs + custom WebSocket + Prisma + Vercel Blob** architecture.

Yjs remains the live collaborative source of truth. Vercel Blob is durable storage only.

## 1. Project Schema

Review `prisma/model/project.prisma`.

- Add or reuse a project field for the durable canvas Blob URL/path.
- Prisma should store only project metadata and the Blob reference.
- Do not store the full canvas JSON in PostgreSQL.
- Keep the field nullable for projects that have never been saved.

Example concept:

```prisma
canvasJsonPath String?