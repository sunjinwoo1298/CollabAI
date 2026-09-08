import { CanvasNode, CanvasEdge, CanvasNodeType, SystemNodeData } from "@/types/canvas";

export interface CanvasTemplate {
  id: string;
  name: string;
  description: string;
  category?: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

// Helper to create template nodes cleanly
export function createTemplateNode(
  id: string,
  type: CanvasNodeType,
  label: string,
  sublabel: string,
  x: number,
  y: number,
  options?: {
    description?: string;
    status?: "active" | "idle" | "error";
    tech?: string;
  }
): CanvasNode {
  const data: SystemNodeData = {
    label,
    sublabel,
    nodeType: type,
    description: options?.description,
    status: options?.status || "active",
    metadata: options?.tech ? { tech: options.tech } : undefined,
  };

  return {
    id,
    type: "system",
    position: { x, y },
    data,
  };
}

// Helper to create template edges cleanly
export function createTemplateEdge(
  id: string,
  source: string,
  target: string,
  options?: {
    sourceHandle?: string;
    targetHandle?: string;
    label?: string;
    animated?: boolean;
  }
): CanvasEdge {
  return {
    id,
    source,
    target,
    sourceHandle: options?.sourceHandle || "source-right",
    targetHandle: options?.targetHandle || "target-left",
    type: "smoothstep",
    animated: options?.animated ?? true,
    label: options?.label,
    style: { stroke: "#64748B", strokeWidth: 2 },
  };
}

// ==========================================
// 1. Microservices Architecture
// ==========================================
const microservicesNodes: CanvasNode[] = [
  createTemplateNode("ms-client", "client", "Web & Mobile Client", "Next.js / React Native", 50, 200, {
    description: "Multi-platform user interfaces interacting with GraphQL and REST endpoints.",
    tech: "Next.js / TypeScript",
  }),
  createTemplateNode("ms-gateway", "gateway", "API Gateway & Ingress", "Envoy / Kong Proxy", 320, 200, {
    description: "Reverse proxy handling SSL termination, rate limiting, and request routing.",
    tech: "Kong / Envoy",
  }),
  createTemplateNode("ms-auth", "service", "Auth Service", "Identity & Access Provider", 600, 60, {
    description: "Issues and verifies JWT session tokens, OAuth2 flows, and RBAC policies.",
    tech: "Go / OIDC",
  }),
  createTemplateNode("ms-order", "service", "Order Service", "Order Orchestration", 600, 200, {
    description: "Handles shopping cart checkout, order workflows, and order state machines.",
    tech: "Node.js / Express",
  }),
  createTemplateNode("ms-payment", "service", "Payment Service", "Financial Processing", 600, 340, {
    description: "PCI-compliant payment processing, webhook listener, and refund handling.",
    tech: "Rust / Stripe API",
  }),
  createTemplateNode("ms-cache", "cache", "Redis Session Cache", "In-Memory Key-Value", 880, 60, {
    description: "Sub-millisecond token and session cache with pub/sub invalidation.",
    tech: "Redis Cluster",
  }),
  createTemplateNode("ms-db-orders", "database", "Orders Database", "PostgreSQL Primary DB", 880, 200, {
    description: "Relational transactional database storing order ledgers and customer records.",
    tech: "PostgreSQL 16",
  }),
  createTemplateNode("ms-queue", "queue", "Event Message Queue", "Apache Kafka Broker", 880, 340, {
    description: "High-throughput event streaming bus for asynchronous inter-service events.",
    tech: "Apache Kafka",
  }),
  createTemplateNode("ms-storage", "storage", "Receipt Storage", "S3 Invoices & Assets", 1160, 340, {
    description: "Secure cold storage for signed PDF invoices and audit log archives.",
    tech: "AWS S3 / MinIO",
  }),
];

const microservicesEdges: CanvasEdge[] = [
  createTemplateEdge("e-ms-1", "ms-client", "ms-gateway"),
  createTemplateEdge("e-ms-2", "ms-gateway", "ms-auth", { sourceHandle: "source-right", targetHandle: "target-left" }),
  createTemplateEdge("e-ms-3", "ms-gateway", "ms-order", { sourceHandle: "source-right", targetHandle: "target-left" }),
  createTemplateEdge("e-ms-4", "ms-gateway", "ms-payment", { sourceHandle: "source-right", targetHandle: "target-left" }),
  createTemplateEdge("e-ms-5", "ms-auth", "ms-cache"),
  createTemplateEdge("e-ms-6", "ms-order", "ms-db-orders"),
  createTemplateEdge("e-ms-7", "ms-order", "ms-queue", { sourceHandle: "source-bottom", targetHandle: "target-top" }),
  createTemplateEdge("e-ms-8", "ms-payment", "ms-queue"),
  createTemplateEdge("e-ms-9", "ms-queue", "ms-storage"),
];

// ==========================================
// 2. CI/CD Deployment Pipeline
// ==========================================
const cicdNodes: CanvasNode[] = [
  createTemplateNode("ci-dev", "client", "Developer Git Push", "Local Workstation / CLI", 50, 180, {
    description: "Engineers push feature branches and pull requests to GitHub repository.",
    tech: "Git / CLI",
  }),
  createTemplateNode("ci-webhook", "gateway", "GitHub Webhook Router", "Event Gateway", 320, 180, {
    description: "Receives commit and PR webhooks and triggers CI build workflows.",
    tech: "Webhook API",
  }),
  createTemplateNode("ci-runner", "service", "CI Build Runner", "Containerized Build Agent", 600, 180, {
    description: "Spawns isolated runner containers, compiles code, and runs lint checks.",
    tech: "GitHub Actions",
  }),
  createTemplateNode("ci-test", "service", "Test & Security Gate", "Unit & E2E Validation", 880, 80, {
    description: "Runs automated unit, integration, SonarQube quality, and vulnerability scans.",
    tech: "Jest / SonarQube",
  }),
  createTemplateNode("ci-registry", "storage", "Docker Image Registry", "OCI Container Registry", 880, 280, {
    description: "Stores immutable tagged Docker container images and Helm charts.",
    tech: "Amazon ECR / GHCR",
  }),
  createTemplateNode("ci-deploy", "service", "K8s GitOps Operator", "ArgoCD / Continuous Delivery", 1160, 180, {
    description: "Reconciles live cluster state with Git declarative manifests automatically.",
    tech: "ArgoCD / Helm",
  }),
  createTemplateNode("ci-cluster", "service", "Production Cluster", "Kubernetes Workloads", 1440, 180, {
    description: "High-availability multi-zone Kubernetes production cluster serving live users.",
    tech: "EKS / Kubernetes",
  }),
  createTemplateNode("ci-monitor", "cache", "Metrics & Telemetry", "Prometheus & Grafana", 1440, 340, {
    description: "Monitors cluster CPU, memory, error rates, and automated alerts.",
    tech: "Prometheus",
  }),
];

const cicdEdges: CanvasEdge[] = [
  createTemplateEdge("e-ci-1", "ci-dev", "ci-webhook"),
  createTemplateEdge("e-ci-2", "ci-webhook", "ci-runner"),
  createTemplateEdge("e-ci-3", "ci-runner", "ci-test", { sourceHandle: "source-top", targetHandle: "target-left" }),
  createTemplateEdge("e-ci-4", "ci-runner", "ci-registry", { sourceHandle: "source-bottom", targetHandle: "target-left" }),
  createTemplateEdge("e-ci-5", "ci-test", "ci-deploy", { sourceHandle: "source-right", targetHandle: "target-top" }),
  createTemplateEdge("e-ci-6", "ci-registry", "ci-deploy", { sourceHandle: "source-right", targetHandle: "target-bottom" }),
  createTemplateEdge("e-ci-7", "ci-deploy", "ci-cluster"),
  createTemplateEdge("e-ci-8", "ci-cluster", "ci-monitor", { sourceHandle: "source-bottom", targetHandle: "target-top" }),
];

// ==========================================
// 3. Event-Driven Real-time Streaming System
// ==========================================
const eventDrivenNodes: CanvasNode[] = [
  createTemplateNode("ed-sources", "client", "Event Producers", "IoT Devices & Telemetry", 50, 200, {
    description: "Thousands of edge devices streaming continuous telemetry and status payloads.",
    tech: "MQTT / HTTP",
  }),
  createTemplateNode("ed-ingress", "gateway", "Ingestion Gateway", "High-Throughput Ingress", 320, 200, {
    description: "Validates incoming telemetry frames and batches records for streaming bus.",
    tech: "HAProxy / Rust",
  }),
  createTemplateNode("ed-kafka", "queue", "Kafka Event Stream", "Partitioned Log Buffer", 600, 200, {
    description: "Distributed commit log buffering real-time sensor events across partitions.",
    tech: "Apache Kafka",
  }),
  createTemplateNode("ed-flink", "service", "Stream Analytics Engine", "Real-Time Compute Processor", 880, 200, {
    description: "Computes sliding-window aggregates, anomaly detections, and trend alerts.",
    tech: "Apache Flink",
  }),
  createTemplateNode("ed-redis", "cache", "Live State Cache", "Real-Time Aggregates", 1160, 80, {
    description: "Holds active device states, latest telemetry values, and fast lookup tables.",
    tech: "Redis In-Memory",
  }),
  createTemplateNode("ed-tsdb", "database", "Time-Series DB", "Historical Metrics Database", 1160, 200, {
    description: "Optimized append-only time-series database for long-term historical trends.",
    tech: "TimescaleDB / ClickHouse",
  }),
  createTemplateNode("ed-s3", "storage", "Data Lake Storage", "Parquet Cold Archive", 1160, 320, {
    description: "Raw compressed events archived into object storage for ML training pipelines.",
    tech: "AWS S3 / Parquet",
  }),
  createTemplateNode("ed-dashboard", "service", "Live Analytics UI", "Real-Time Dashboard API", 1440, 140, {
    description: "Websocket and REST API delivering live telemetry dashboards to operations team.",
    tech: "Next.js / WebSocket",
  }),
];

const eventDrivenEdges: CanvasEdge[] = [
  createTemplateEdge("e-ed-1", "ed-sources", "ed-ingress"),
  createTemplateEdge("e-ed-2", "ed-ingress", "ed-kafka"),
  createTemplateEdge("e-ed-3", "ed-kafka", "ed-flink"),
  createTemplateEdge("e-ed-4", "ed-flink", "ed-redis", { sourceHandle: "source-top", targetHandle: "target-left" }),
  createTemplateEdge("e-ed-5", "ed-flink", "ed-tsdb"),
  createTemplateEdge("e-ed-6", "ed-flink", "ed-s3", { sourceHandle: "source-bottom", targetHandle: "target-left" }),
  createTemplateEdge("e-ed-7", "ed-redis", "ed-dashboard", { sourceHandle: "source-right", targetHandle: "target-left" }),
  createTemplateEdge("e-ed-8", "ed-tsdb", "ed-dashboard", { sourceHandle: "source-right", targetHandle: "target-left" }),
];

// ==========================================
// 4. AI / RAG Pipeline Architecture
// ==========================================
const aiRagNodes: CanvasNode[] = [
  createTemplateNode("ai-client", "client", "AI Chat Interface", "Streaming Assistant UI", 50, 180, {
    description: "Conversational UI with streaming tokens, citations, and interactive charts.",
    tech: "React / Vercel AI SDK",
  }),
  createTemplateNode("ai-gateway", "gateway", "API & Auth Gateway", "Edge Ingress Proxy", 320, 180, {
    description: "Validates user permissions, enforces rate limits, and buffers requests.",
    tech: "Next.js Middleware",
  }),
  createTemplateNode("ai-orchestrator", "service", "RAG Orchestrator", "LangGraph / LLM Agent", 600, 180, {
    description: "Synthesizes user queries, retrieves vector context, and coordinates model reasoning.",
    tech: "Python / FastAPI",
  }),
  createTemplateNode("ai-cache", "cache", "Semantic Cache", "Embedding Similarity Cache", 880, 60, {
    description: "Caches frequent LLM responses based on cosine similarity of user prompts.",
    tech: "Redis Vector Cache",
  }),
  createTemplateNode("ai-vector-db", "database", "Vector Database", "Context Embeddings Store", 880, 200, {
    description: "High-dimensional vector index for fast similarity search across knowledge base.",
    tech: "Pinecone / Qdrant",
  }),
  createTemplateNode("ai-storage", "storage", "Document Store", "PDFs & Knowledge Base", 880, 340, {
    description: "Raw knowledge base documents, Markdown files, and parsed metadata chunks.",
    tech: "S3 Object Store",
  }),
  createTemplateNode("ai-llm", "service", "LLM Inference API", "Anthropic & OpenAI Models", 1160, 180, {
    description: "Multi-model inference endpoint with structured tool calling and prompt routing.",
    tech: "Claude 3.7 / GPT-4o",
  }),
];

const aiRagEdges: CanvasEdge[] = [
  createTemplateEdge("e-ai-1", "ai-client", "ai-gateway"),
  createTemplateEdge("e-ai-2", "ai-gateway", "ai-orchestrator"),
  createTemplateEdge("e-ai-3", "ai-orchestrator", "ai-cache", { sourceHandle: "source-top", targetHandle: "target-left" }),
  createTemplateEdge("e-ai-4", "ai-orchestrator", "ai-vector-db"),
  createTemplateEdge("e-ai-5", "ai-vector-db", "ai-storage", { sourceHandle: "source-bottom", targetHandle: "target-top" }),
  createTemplateEdge("e-ai-6", "ai-orchestrator", "ai-llm"),
];

// ==========================================
// All Predefined Templates Export
// ==========================================
export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: "template-microservices",
    name: "Microservices Architecture",
    description: "Scalable e-commerce backend with API Gateway, Auth, Order & Payment services, PostgreSQL DB, Redis cache, and Kafka queue.",
    category: "Backend & Systems",
    nodes: microservicesNodes,
    edges: microservicesEdges,
  },
  {
    id: "template-cicd-pipeline",
    name: "CI/CD Deployment Pipeline",
    description: "Automated continuous integration and GitOps delivery pipeline with build runners, security gates, image registry, and Kubernetes cluster.",
    category: "DevOps & Infrastructure",
    nodes: cicdNodes,
    edges: cicdEdges,
  },
  {
    id: "template-event-driven",
    name: "Event-Driven Streaming System",
    description: "High-throughput real-time telemetry pipeline using Kafka broker, Apache Flink stream analytics, time-series DB, and live dashboard.",
    category: "Data & Streaming",
    nodes: eventDrivenNodes,
    edges: eventDrivenEdges,
  },
  {
    id: "template-ai-rag",
    name: "AI & RAG Pipeline",
    description: "Retrieval-Augmented Generation architecture with conversational UI, embedding search in Vector DB, semantic cache, and LLM inference engine.",
    category: "AI & Machine Learning",
    nodes: aiRagNodes,
    edges: aiRagEdges,
  },
];
