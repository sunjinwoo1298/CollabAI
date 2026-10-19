import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { generateObject, generateText } from "ai";
import { DesignPlan, DesignPlanSchema } from "./design-schema";
import { CanvasNodeType } from "@/types/canvas";

export interface NodeSummary {
  id: string;
  type: CanvasNodeType;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  description?: string;
}

export interface EdgeSummary {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface PlannerContext {
  prompt: string;
  existingNodes: NodeSummary[];
  existingEdges: EdgeSummary[];
}

export interface PlannerOptions {
  apiKey?: string;
  modelName?: string;
  provider?: "groq" | "google";
  customGeneratePlan?: (context: PlannerContext) => Promise<DesignPlan>;
}

export const SYSTEM_ARCHITECT_PROMPT = `
You are Collab AI's Distributed System Architecture Engine.
You translate natural language architectural requirements into structured React Flow canvas mutations (nodes and edges).

### Available Node Archetypes:
- "client": Web / mobile frontends, browser clients, IoT devices
- "gateway": API gateways, reverse proxies, ingress load balancers
- "service": Core microservices, backend application servers, compute workers
- "database": Relational DBs (Postgres, MySQL), document DBs (Mongo)
- "cache": In-memory stores (Redis, Memcached)
- "queue": Event streaming / message brokers (Kafka, RabbitMQ, SQS)
- "storage": Object / blob storage (S3, GCS)
- "custom": Custom infrastructure components

### Spatial Layout & Flow Coordinates Rules (CRITICAL):
- React Flow uses an infinite 2D canvas coordinate system (NOT screen pixel boundaries).
- Standard node dimensions: 220 width by 100 height.
- Tiered horizontal spacing: maintain ~260px - 320px between architecture tiers (e.g., Client -> Gateway -> Service -> Database/Cache).
- Parallel vertical spacing: maintain ~140px - 180px between parallel services or datastores.
- NEVER stack nodes at (0, 0) and NEVER overlap existing node bounding boxes.
- For an empty canvas:
  - Client tier: x = 100, y = 150
  - Gateway tier: x = 380, y = 150
  - Service tier: x = 660, y = 150
  - Data / Cache / Queue tier: x = 940, y = 80 (top), y = 220 (bottom)
- For an existing canvas:
  - Analyze the provided bounding boxes of existing nodes.
  - Insert new nodes relative to the components they interact with.
  - For example, if inserting a Redis cache between a service and a database, calculate intermediate coordinates (e.g., midpoint or offset) and redirect or insert connections cleanly.
  - When modifying or deleting, use the exact existing IDs provided.
  - For new nodes, generate unique, descriptive IDs such as "node-cache-redis" or "node-service-auth".
  - For new edges, generate IDs such as "e-gateway-to-service" and use appropriate handle ports:
    - Left-to-right flow: sourceHandle = "source-right", targetHandle = "target-left"
    - Top-to-bottom flow: sourceHandle = "source-bottom", targetHandle = "target-top"
- Incremental updates: NEVER replace the entire canvas unless the user explicitly asks to start from scratch. Preserve existing, unrelated nodes and edges.
`;

/**
 * Plans architecture mutations using Groq or Gemini.
 */
export async function planArchitectureChanges(
  context: PlannerContext,
  options?: PlannerOptions
): Promise<DesignPlan> {
  // Allow custom override for unit tests or offline environments
  if (options?.customGeneratePlan) {
    return options.customGeneratePlan(context);
  }

  // Determine provider: prioritize Groq if GROQ_API_KEY is present or explicitly requested
  const groqApiKey = options?.apiKey || process.env.GROQ_API_KEY;
  const googleApiKey =
    options?.apiKey ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY;

  const provider =
    options?.provider ||
    (groqApiKey ? "groq" : googleApiKey ? "google" : null);

  if (!provider) {
    throw new Error(
      "No AI API key found. Please set GROQ_API_KEY or GOOGLE_AI_API_KEY in the environment."
    );
  }

  // Build spatial summary of existing canvas
  const existingNodesSummary =
    context.existingNodes.length > 0
      ? JSON.stringify(
          context.existingNodes.map((n) => ({
            id: n.id,
            type: n.type,
            label: n.label,
            sublabel: n.sublabel,
            x: Math.round(n.x),
            y: Math.round(n.y),
            width: Math.round(n.width),
            height: Math.round(n.height),
            description: n.description,
          })),
          null,
          2
        )
      : "Canvas is currently empty.";

  const existingEdgesSummary =
    context.existingEdges.length > 0
      ? JSON.stringify(
          context.existingEdges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
          })),
          null,
          2
        )
      : "No existing edges.";

  const userPrompt = `
USER REQUEST:
"${context.prompt}"

CURRENT CANVAS STATE:
Existing Nodes (${context.existingNodes.length}):
${existingNodesSummary}

Existing Edges (${context.existingEdges.length}):
${existingEdgesSummary}

Please generate a structured design plan to fulfill the user request following the spatial layout and architecture guidelines.
`;

  if (provider === "groq") {
    if (!groqApiKey) {
      throw new Error("GROQ_API_KEY is not configured.");
    }

    const modelName =
      options?.modelName || process.env.GROQ_MODEL || "openai/gpt-oss-120b";

    const groq = createGroq({ apiKey: groqApiKey });
    const model = groq(modelName);

    const fullPrompt = `${SYSTEM_ARCHITECT_PROMPT}

OUTPUT FORMAT SPECIFICATION:
You must output ONLY valid, raw JSON conforming to this schema (do NOT include markdown formatting or commentary):
{
  "summary": "High-level summary of architectural changes",
  "operations": [
    {
      "type": "add_node",
      "id": "node-unique-id",
      "nodeType": "client" | "gateway" | "service" | "database" | "cache" | "queue" | "storage" | "custom",
      "label": "Display Title",
      "sublabel": "Subtitle / Tech",
      "position": { "x": 100, "y": 150 },
      "tech": "PostgreSQL / Redis / etc"
    },
    {
      "type": "add_edge",
      "id": "e-source-target",
      "source": "node-source-id",
      "target": "node-target-id",
      "sourceHandle": "source-right",
      "targetHandle": "target-left",
      "label": "Protocol / Traffic"
    }
  ]
}

${userPrompt}
`;

    const result = await generateText({
      model,
      prompt: fullPrompt,
      temperature: 0.1,
    });

    let text = result.text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```$/, "");
    }
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1);
    }

    const parsedJson = JSON.parse(text);
    return DesignPlanSchema.parse(parsedJson);
  } else {
    if (!googleApiKey) {
      throw new Error(
        "GOOGLE_AI_API_KEY is not configured. Please set GOOGLE_AI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY in the environment."
      );
    }

    const modelName =
      options?.modelName || process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const google = createGoogleGenerativeAI({ apiKey: googleApiKey });
    const model = google(modelName);

    const result = await generateObject({
      model,
      schema: DesignPlanSchema,
      system: SYSTEM_ARCHITECT_PROMPT,
      prompt: userPrompt,
      temperature: 0.2,
    });

    return result.object;
  }
}

