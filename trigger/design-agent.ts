import { task } from "@trigger.dev/sdk";

export interface DesignAgentPayload {
  prompt: string;
  roomId: string;
  projectId?: string;
}

export interface DesignAgentOutput {
  success: boolean;
  prompt: string;
  roomId: string;
  projectId?: string;
  echoedAt: string;
}

export const designAgentTask = task({
  id: "design-agent",
  run: async (payload: DesignAgentPayload): Promise<DesignAgentOutput> => {
    console.log("[design-agent] Executing design task with payload:", {
      prompt: payload.prompt,
      roomId: payload.roomId,
      projectId: payload.projectId,
    });

    return {
      success: true,
      prompt: payload.prompt,
      roomId: payload.roomId,
      projectId: payload.projectId,
      echoedAt: new Date().toISOString(),
    };
  },
});

export const designTask = designAgentTask;
