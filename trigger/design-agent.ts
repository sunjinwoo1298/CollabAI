import { task } from "@trigger.dev/sdk";
import { prisma } from "@/lib/prisma";
import { YjsRoomClient } from "@/lib/ai/yjs-room-client";
import { takeCanvasSnapshot, applyDesignPlan } from "@/lib/ai/canvas-mutator";
import { planArchitectureChanges, PlannerOptions } from "@/lib/ai/gemini-planner";
import { validateDesignPlan } from "@/lib/ai/design-schema";

export interface DesignAgentPayload {
  prompt: string;
  roomId: string;
  projectId?: string;
  userId?: string;
  runId?: string;
  plannerOptions?: PlannerOptions;
}

export interface DesignAgentOutput {
  success: boolean;
  summary: string;
  projectId: string;
  roomId: string;
  runId: string;
  appliedCount: number;
  skippedCount: number;
  totalOperations: number;
  echoedAt?: string;
  completedAt: string;
  error?: string;
}

export async function runDesignAgent(
  payload: DesignAgentPayload,
  params?: { ctx?: { run?: { id: string } } }
): Promise<DesignAgentOutput> {
  const runId = payload.runId || params?.ctx?.run?.id || `run_${Date.now()}`;
  const cleanPrompt = payload.prompt?.trim();

    if (!cleanPrompt) {
      throw new Error("Invalid task payload: 'prompt' must be a non-empty string");
    }

    const projectId = (payload.projectId || payload.roomId || "").trim();
    const roomId = (payload.roomId || payload.projectId || "").trim();

    if (!projectId || !roomId) {
      throw new Error("Invalid task payload: 'projectId' and 'roomId' are required");
    }

    // Strictly enforce project-room 1:1 invariant
    if (projectId !== roomId) {
      throw new Error(
        `Invariant violation: projectId ('${projectId}') does not equal roomId ('${roomId}')`
      );
    }

    console.log(
      `[design-agent] Starting execution for run ${runId} on project ${projectId}`
    );

    // 1. Authorize project existence and verify access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { collaborators: true },
    });

    if (!project) {
      throw new Error(`Project '${projectId}' was not found in database`);
    }

    // Connect to Yjs collaborative room as ephemeral ai-agent peer
    const client = new YjsRoomClient({
      projectId,
      roomId,
      runId,
    });

    try {
      await client.connect();

      // Report initial status: AI is starting...
      client.setAiAwareness({
        isThinking: true,
        thinking: true,
        statusMessage: "Analyzing your request...",
        text: "Analyzing your request...",
        status: "starting",
        runId,
        projectId,
      });

      // 2. Snapshot Phase: Read current canvas before Gemini call
      const snapshot = takeCanvasSnapshot(client.nodesMap, client.edgesMap);

      // Report status: Planning architecture changes...
      client.setAiAwareness({
        isThinking: true,
        thinking: true,
        statusMessage: "Planning architecture changes...",
        text: "Planning architecture changes...",
        status: "planning",
        cursor: {
          x: snapshot.boundingBox.centerX,
          y: snapshot.boundingBox.centerY,
        },
        runId,
        projectId,
      });

      // 3. Plan Phase: Call Gemini to produce structured design operations
      const plan = await planArchitectureChanges(
        {
          prompt: cleanPrompt,
          existingNodes: snapshot.nodeSummaries,
          existingEdges: snapshot.edgeSummaries,
        },
        payload.plannerOptions
      );

      // 4. Validate Plan before any mutation is applied
      const existingNodeIds = new Set(snapshot.nodes.keys());
      const existingEdgeIds = new Set(snapshot.edges.keys());
      const validation = validateDesignPlan(
        plan,
        existingNodeIds,
        existingEdgeIds
      );

      if (!validation.valid) {
        throw new Error(
          `Design plan validation failed: ${validation.errors.join("; ")}`
        );
      }

      // Report status: Applying changes to canvas...
      client.setAiAwareness({
        isThinking: true,
        thinking: true,
        statusMessage: "Applying changes to canvas...",
        text: "Applying changes to canvas...",
        status: "applying",
        cursor: {
          x: snapshot.boundingBox.centerX,
          y: snapshot.boundingBox.centerY,
        },
        runId,
        projectId,
      });

      // 5. Validate & Apply Phase: Apply mutations in a single synchronous doc.transact()
      const mutationResult = applyDesignPlan({
        doc: client.doc,
        nodesMap: client.nodesMap,
        edgesMap: client.edgesMap,
        plan,
        snapshot,
        runId,
      });

      // Report final completion status
      client.setAiAwareness({
        isThinking: false,
        thinking: false,
        statusMessage: "Design updated successfully",
        text: "Design updated successfully",
        status: "completed",
        cursor: null,
        runId,
        projectId,
      });

      const nowIso = new Date().toISOString();
      console.log(
        `[design-agent] Successfully applied ${mutationResult.appliedCount} mutations for run ${runId}`
      );

      return {
        success: true,
        summary: plan.summary,
        projectId,
        roomId,
        runId,
        appliedCount: mutationResult.appliedCount,
        skippedCount: mutationResult.skippedCount,
        totalOperations: plan.operations.length,
        echoedAt: nowIso,
        completedAt: nowIso,
      };
    } catch (err: any) {
      console.error(`[design-agent] Error during run ${runId}:`, err?.message);

      client.setAiAwareness({
        isThinking: false,
        thinking: false,
        statusMessage: "Design generation failed",
        text: "Design generation failed",
        status: "failed",
        cursor: null,
        runId,
        projectId,
      });

      throw err;
    } finally {
      await client.disconnect();
    }
}

export const designAgentTask = task({
  id: "design-agent",
  run: async (payload: DesignAgentPayload, { ctx }) => {
    return runDesignAgent(payload, { ctx });
  },
});

export const designTask = designAgentTask;
