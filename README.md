# Collaborator AI

Collaborator AI is a real-time collaborative system architecture platform that integrates conflict-free replicated data types (CRDTs), high-throughput WebSocket communication, and an autonomous AI design agent. The platform enables distributed engineering teams to design, mutate, and review complex software architectures simultaneously without third-party real-time service dependencies.

---

## Key Capabilities

- **Real-Time Canvas Collaboration**: Sub-millisecond peer synchronization using Yjs CRDTs (`nodes` and `edges` maps) and binary `lib0` encoding over custom WebSockets, bypassing vendor lock-in.
- **Horizontal Scaling via Redis Pub/Sub**: Multi-instance WebSocket backplane for cross-server document synchronization, cursor presence, and ephemeral awareness propagation.
- **Autonomous AI Architecture Agent**: Durable background task execution powered by Trigger.dev and the Vercel AI SDK (Google Gemini), executing atomic CRDT canvas mutations with real-time awareness and thinking states.
- **Idempotent Room Chat**: Authoritative HTTP/PostgreSQL/Redis message delivery pipeline with client-generated stable IDs, eliminating dual-path race conditions, primary key collisions (`P2002`), and ghost messages under database failures.
- **Identity & Access Management**: Clerk-authenticated sessions with project-scoped role-based access control (owner vs. collaborator) and short-lived, cryptographically signed room JWTs for WebSocket connections.
- **Automatic Persistence & Snapshots**: PostgreSQL persistence via Prisma ORM with automated debounced canvas state synchronization and complete chronological history rehydration.

---

## System Architecture

```
                                      +-------------------------+
                                      |   Web Browser (Client)  |
                                      +------------+------------+
                                                   |
                         +-------------------------+-------------------------+
                         | HTTP (Next.js 16)                                 | WebSocket (Binary lib0)
                         v                                                   v
           +-----------------------------+                     +-----------------------------+
           |     Next.js Web Server      |                     |   Custom WebSocket Server   |
           |     (App Router, Clerk)     |                     |    (Node.js / y-websocket)  |
           +--------------+--------------+                     +--------------+--------------+
                          |                                                   |
                          | Publishes Events                                  | Subscribes / Broadcasts
                          +-------------------------+-------------------------+
                                                    |
                                                    v
                                      +-------------------------+
                                      |     Redis Pub/Sub       |
                                      | (yjs:room:* Backplane)  |
                                      +-------------------------+
                                                    |
                                                    v
                                      +-------------------------+
                                      |   PostgreSQL (Prisma)   |
                                      | (Projects, Chat, Runs)  |
                                      +-------------------------+
                                                    ^
                                                    | Canvas Mutations & Run Updates
                                      +-------------+-----------+
                                      |  Trigger.dev Background |
                                      |   AI Design Agent Task  |
                                      +-------------------------+
```

### Architectural Highlights

1. **Collaboration Pipeline**:
   - The client connects to `ws-server` using a short-lived room JWT minted by `/api/ws-auth`.
   - Node and edge mutations are stored locally in a Yjs Document and broadcast as binary updates.
   - The WebSocket server applies updates to in-memory room instances and fans them out to Redis (`yjs:room:${roomId}`), ensuring immediate synchronization across instances.

2. **Idempotent Chat Pipeline**:
   - `POST /api/projects/[projectId]/messages` serves as the authoritative persistence and acceptance point.
   - Every submission carries a stable message ID (`msg_<timestamp>_<uuid>`).
   - The handler performs duplicate verification before database insertion; duplicate submissions return HTTP 200 and suppress duplicate Redis broadcasts.
   - WebSocket handlers verify persistence before relaying messages, preventing unpersisted "ghost messages".

3. **AI Task Execution**:
   - Prompts submitted in the workspace sidebar trigger background runs via `tasks.trigger("design-agent", payload)`.
   - The background worker queries Gemini via the Vercel AI SDK, validates structured architectural mutations via Zod, and connects a headless Yjs client to apply operations in an atomic transaction (`doc.transact(..., "ai-design-agent")`).
   - Clients monitor progress via Trigger.dev realtime hooks using cryptographically scoped public tokens.

---

## Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router, Turbopack) | Web application framework, API route handlers |
| **Frontend Runtime** | React 19, TypeScript 5, Tailwind CSS 4 | Modern reactive user interface and styling |
| **Visual Canvas** | @xyflow/react (React Flow) | Node-edge graph rendering and interaction |
| **CRDT Engine** | Yjs, y-protocols, lib0 | Conflict-free replicated data types and binary protocol |
| **Real-Time Transport** | ws, y-websocket | Dedicated WebSocket server implementation |
| **Pub/Sub Backplane** | Redis (ioredis) | Cross-instance real-time state synchronization |
| **Database & ORM** | PostgreSQL, Prisma ORM 7 | Relational data persistence, schema migrations |
| **Authentication** | Clerk (@clerk/nextjs) | User authentication, identity verification, RBAC |
| **Background Jobs** | Trigger.dev v4 (@trigger.dev/sdk) | Durable long-running AI orchestration engine |
| **AI Synthesis** | Vercel AI SDK, @ai-sdk/google (Gemini) | Architecture planning and structured JSON output |

---

## Project Structure

```
Collaborator_AI/
├── app/                              # Next.js App Router
│   ├── api/                          # REST API routes
│   │   ├── ai/design/                # Trigger.dev AI task dispatch & token minting
│   │   ├── projects/                 # Project CRUD, collaborators, canvas, messages
│   │   └── ws-auth/                  # WebSocket authentication and token issuance
│   ├── editor/[roomId]/              # Collaborative canvas workspace page
│   └── (auth)/                       # Clerk sign-in and sign-up flows
├── components/                       # React component library
│   ├── canvas/                       # React Flow canvas, node/edge types, avatars
│   ├── editor/                       # Workspace shell, AI sidebar, room chat feed
│   └── ui/                           # Base UI primitives (Radix UI / Tailwind)
├── hooks/                            # Custom React hooks
│   ├── useCanvasSync.ts              # Yjs CRDT binding to React Flow state
│   ├── useRoomChat.ts                # Authoritative room chat subscription & send
│   └── useYjsRoom.ts                 # WebSocket provider lifecycle and awareness
├── lib/                              # Core business logic and shared clients
│   ├── ai/                           # Gemini planner, canvas mutator, Yjs client
│   ├── prisma.ts                     # Prisma client singleton
│   └── project-access.ts             # Clerk identity extraction & access control
├── prisma/                           # Database schema and migrations
│   ├── schema.prisma                 # Core Prisma configuration
│   └── models/                       # Modular Prisma schemas (Project, Chat, TaskRun)
├── trigger/                          # Trigger.dev task declarations
│   └── design-agent.ts               # Autonomous design agent definition
├── types/                            # Shared TypeScript interfaces & Zod schemas
│   ├── canvas.ts                     # Nodes, edges, and collaborator types
│   ├── collaboration.ts              # Chat messages, WebSocket payloads, schemas
│   └── tasks.ts                      # AI activity states and lifecycle payloads
├── ws-server/                        # Dedicated WebSocket real-time server
│   └── src/
│       ├── redis.ts                  # Redis Pub/Sub manager and caching
│       ├── room.ts                   # In-memory Yjs room management & deduplication
│       └── server.ts                 # HTTP upgrade handling & JWT verification
└── test/                             # Comprehensive automated test suites
    ├── perf/                         # Performance benchmarks (WS, CRDT, DB, Web)
    ├── canvas-sync.test.ts           # CRDT multi-peer synchronization tests
    ├── chat-durability.test.ts       # Idempotency, duplicate suppression, ghost prevention
    └── ai-chat-functional.test.ts    # AI agent orchestration and awareness tests
```

---

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- PostgreSQL database instance
- Redis server instance (optional for single-process development, required for multi-instance fan-out)
- Clerk account and API keys
- Trigger.dev account and project reference
- Groq/Gemini API key

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/collaborator-ai.git
cd collaborator-ai
npm install
```

### 2. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_WS_URL="ws://localhost:1234"

# Database (PostgreSQL via Prisma)
DATABASE_URL="postgresql://user:password@localhost:5432/collaborator_ai?sslmode=prefer"

# Redis Backplane
REDIS_URL="redis://localhost:6379"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# Trigger.dev
TRIGGER_SECRET_KEY="tr_dev_..."
TRIGGER_PROJECT_REF="proj_..."

# Google Gemini AI
GOOGLE_GENERATIVE_AI_API_KEY="AIzaSy..."
```

### 3. Database Initialization

Push the Prisma schema to your PostgreSQL database:

```bash
npx prisma db push
```

### 4. Running the Development Environment

Running the full system requires starting the Next.js application, the WebSocket server, and the Trigger.dev worker concurrently:

```bash
# Terminal 1: Next.js Frontend & API Server (Port 3000)
npm run dev

# Terminal 2: Real-Time WebSocket Server (Port 1234)
npm run ws:dev

# Terminal 3: Trigger.dev Background Agent Worker
npm run trigger:dev
```

Open `http://localhost:3000` to access the application.

---

## Testing & Verification

The repository includes comprehensive automated test suites verifying CRDT synchronization, presence, AI orchestration, and chat delivery durability.

### Run All Tests

```bash
npm test
```

### Targeted Test Suites

```bash
# Run Chat Durability & Idempotency Tests
npm run test:durability

# Run AI Sidebar & Agent Functional Tests
npm run test:ai-chat

# Run Real-Time Canvas CRDT Sync Tests
npm run test:canvas

# Run Presence, Avatar, and Cursor Tests
npm run test:presence

# Run Design Agent API & Trigger Tests
npm run test:design-api
```

### Performance & Benchmarking

```bash
# Run All Performance Benchmarks
npm run bench

# Run WebSocket Burst & Throughput Benchmark
npm run bench:ws

# Run Yjs In-Memory CRDT Sync Benchmark
npm run bench:crdt

# Run Database Latency & Query Decomposition Diagnostics
npm run bench:db
```

---

## License

This project is licensed under the MIT License.
