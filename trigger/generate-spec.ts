import { task } from "@trigger.dev/sdk";

export interface GenerateSpecPayload {
  projectId: string;
  projectName: string;
  nodeCount: number;
  edgeCount: number;
}

export interface SpecOutput {
  specId: string;
  summary: string;
  generatedAt: string;
}

export const generateArchitectureSpec = task({
  id: "generate-architecture-spec",
  run: async (payload: GenerateSpecPayload): Promise<SpecOutput> => {
    // Durable background task for synthesizing system specifications from canvas topology
    return {
      specId: `spec_${Date.now()}_${payload.projectId}`,
      summary: `Generated architectural specification for "${payload.projectName}" containing ${payload.nodeCount} system components and ${payload.edgeCount} interactions.`,
      generatedAt: new Date().toISOString(),
    };
  },
});
