# UI Context

## Theme

Dark only. No light mode. The visual language is a dark, high-end enterprise infrastructure and cybersecurity workspace — deep cold-slate backgrounds, layered surfaces, and highly focused semantic accent colors.

All colors are defined as CSS custom properties in `globals.css` and mapped to Tailwind tokens via `@theme inline`. Components must use these tokens — no hardcoded hex values or raw Tailwind color classes.

| Role             | CSS Variable           | Hex / Value               | Tailwind Class       |
| ---------------- | ---------------------- | ------------------------- | -------------------- |
| Page background  | `--bg-base`            | `#0B0F19`                 | `bg-base`            |
| Surface          | `--bg-surface`         | `#161B26`                 | `bg-surface`         |
| Elevated surface | `--bg-elevated`        | `#1F2635`                 | `bg-elevated`        |
| Subtle surface   | `--bg-subtle`          | `#262E3F`                 | `bg-subtle`          |
| Default border   | `--border-default`     | `#2A3447`                 | `border-default`     |
| Subtle border    | `--border-subtle`      | `#37435C`                 | `border-subtle`      |
| Primary text     | `--text-primary`       | `#F1F5F9`                 | `text-primary`       |
| Secondary text   | `--text-secondary`     | `#CBD5E1`                 | `text-secondary`     |
| Muted text       | `--text-muted`         | `#94A3B8`                 | `text-muted`         |
| Faint text       | `--text-faint`         | `#64748B`                 | `text-faint`         |
| Brand accent     | `--accent-primary`     | `#10B981` (emerald)       | `text-brand` / `bg-brand` |
| Brand dim        | `--accent-primary-dim` | `rgba(16, 185, 129, 0.1)` | `bg-brand-dim`       |
| AI accent        | `--accent-ai`          | `#6366F1` (indigo)        | `text-ai` / `bg-ai`   |
| AI text          | `--accent-ai-text`     | `#818CF8`                 | `text-ai-muted`      |
| Error            | `--state-error`        | `#EF4444`                 | `text-error`         |
| Success          | `--state-success`      | `#10B981`                 | `text-success`       |
| Warning          | `--state-warning`      | `#F59E0B`                 | `text-warning`       |

Components consume these variables strictly via their Tailwind utility names (e.g., `bg-base`, `bg-surface`, `text-primary`, `border-default`, `bg-brand-dim`).

## Typography

| Role      | Font       | CSS Variable        |
| --------- | ---------- | ------------------- |
| UI text   | Geist Sans | `--font-geist-sans` |
| Code/mono | Geist Mono | `--font-geist-mono` |

Both fonts are loaded via `next/font/google` and applied as CSS variables on the `<html>` element. The base `body` uses Geist Sans with `antialiased`.

## Border Radius

Radius increases with surface depth — smaller for inner elements, larger for outer containers.

| Context           | Class         |
| ----------------- | ------------- |
| Inline / small UI | `rounded-xl`  |
| Cards / panels    | `rounded-2xl` |
| Modal / overlay   | `rounded-3xl` |

## Canvas

### Node Color Palette

8 enterprise-grade color pairs optimized for absolute legibility over deep slate canvas depths. Fills are dark and desaturated, while typography uses crisp, vibrant tones. Defined in `types/canvas.ts` as `NODE_COLORS`.

| Node fill | Text color | Character Description  |
| --------- | ---------- | ---------------------- |
| `#1E293B` | `#F8FAFC`  | Slate / Neutral Dark   |
| `#0F213A` | `#60A5FA`  | Blue (Network/Ingress) |
| `#281C3D` | `#C084FC`  | Purple (Compute/Logic) |
| `#362016` | `#FBBF24`  | Amber (Security/IAM)   |
| `#3B1A1C` | `#F87171`  | Red (Alerts/Dead Ends) |
| `#36192A` | `#F472B6`  | Pink (Third-Party/API) |
| `#062C21` | `#34D399`  | Green (Active/Healthy) |
| `#0A2A2D` | `#2DD4BF`  | Teal (Storage/Caching) |

Default node color: `#1E293B` with `#F8FAFC` text.

### Edge Style

Smooth-step path with an arrow marker. 
- **Idle Edge Color:** `--border-subtle` (`#37435C`). Thin stroke width, kept visually secondary to nodes to avoid flickering during zoom actions.
- **Active / Selected Edge Color:** `--accent-primary` (`#10B981`) or `--accent-ai` (`#6366F1`) based on path initiation context.

### Node Shapes

6 supported shapes, defined in `types/canvas.ts` as `NODE_SHAPES`. Complex shapes (diamond, hexagon, cylinder) are rendered as inline SVGs rather than CSS borders.

- `rectangle` — default general-purpose node
- `diamond` — decision / gateway
- `circle` — event / endpoint
- `pill` — service / process
- `cylinder` — database / storage
- `hexagon` — external system / boundary

### Connection Handles

Small circular handles matching `--border-default` (`#2A3447`) with a pure white center dot. Hidden by default, revealed globally on node hover. 
- **Visual implementation:** Kept compact (`w-2 h-2`).
- **Interaction layer:** Implements an invisible pseudo-element container mapping to an explicit bounding area of at least `w-6 h-6` to ensure stable interactive drag hitboxes.

## Component Library

shadcn/ui on top of Tailwind. No custom design system. Components live in `components/ui/`. Use the `shadcn` CLI to add new components rather than writing them from scratch.

## Layout Patterns

- Editor workspace: full-viewport layout — floating sidebar overlay on the left, center canvas, slide-over AI sidebar on the right.
- Sidebars: floating overlay with dark semi-transparent background and subtle border.
- Modals and dialogs: centered overlay, `rounded-3xl`, dark background with backdrop blur.
- Navbar: top bar with dark background and bottom border.

## Icons

Lucide React. Stroke-based icons only — no filled variants. Icon sizes: `h-4 w-4` for inline, `h-5 w-5` for buttons, `h-8 w-8` for feature icons in empty states.
