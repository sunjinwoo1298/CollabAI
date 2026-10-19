import { z } from "zod";

/**
 * Task run lifecycle states
 */
export const TaskLifecycleStatusSchema = z.enum([
  "idle",
  "starting",
  "planning",
  "applying",
  "completed",
  "failed",
  "cancelled",
]);

export type TaskLifecycleStatus = z.infer<typeof TaskLifecycleStatusSchema>;

/**
 * Zod schema for shared AI activity status payload
 */
export const TaskStatusPayloadSchema = z.object({
  runId: z.string().min(1, "runId is required"),
  projectId: z.string().min(1, "projectId is required"),
  roomId: z.string().optional(),
  thinking: z.boolean().optional(),
  isThinking: z.boolean().optional(),
  text: z.string().optional(),
  statusMessage: z.string().optional(),
  status: z.union([TaskLifecycleStatusSchema, z.string()]).optional(),
  timestamp: z.number().optional(),
  cursor: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .nullable()
    .optional(),
  error: z.string().optional(),
});

export type TaskStatusPayload = z.infer<typeof TaskStatusPayloadSchema>;

export interface StatusValidationResult {
  valid: boolean;
  error?: string;
  data?: TaskStatusPayload;
}

/**
 * Validates an incoming status payload against schema, project ID, and run/timestamp freshness.
 */
export function validateTaskStatusPayload(
  payload: unknown,
  options?: {
    expectedProjectId?: string;
    currentRunId?: string;
    lastTimestamp?: number;
  }
): StatusValidationResult {
  // 1. Schema validation
  const parseResult = TaskStatusPayloadSchema.safeParse(payload);
  if (!parseResult.success) {
    return {
      valid: false,
      error: `Malformed status payload: ${parseResult.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join(", ")}`,
    };
  }

  const data = parseResult.data;

  // 2. Project ID validation
  if (options?.expectedProjectId && data.projectId !== options.expectedProjectId) {
    return {
      valid: false,
      error: `Mismatched projectId: expected '${options.expectedProjectId}', got '${data.projectId}'`,
    };
  }

  // 3. Stale update or mismatched run validation
  if (options?.currentRunId && data.runId !== options.currentRunId) {
    // If incoming update is from a different run
    return {
      valid: false,
      error: `Stale or mismatched runId: expected '${options.currentRunId}', got '${data.runId}'`,
    };
  }

  // 4. Stale timestamp validation for same run
  if (
    options?.lastTimestamp &&
    data.timestamp &&
    data.timestamp < options.lastTimestamp
  ) {
    return {
      valid: false,
      error: `Stale timestamp: incoming (${data.timestamp}) is older than last recorded (${options.lastTimestamp})`,
    };
  }

  return {
    valid: true,
    data,
  };
}

/**
 * Determines whether a given status payload represents active AI generation.
 */
export function isTaskStatusActive(payload?: Partial<TaskStatusPayload> | null): boolean {
  if (!payload) return false;
  if (payload.thinking === true || payload.isThinking === true) {
    return true;
  }
  if (
    typeof payload.status === "string" &&
    ["starting", "planning", "applying"].includes(payload.status.toLowerCase())
  ) {
    return true;
  }
  return false;
}

/**
 * Helper to ensure one run cannot clear another active run's activity.
 */
export function canClearRun(
  activeRunId: string | null | undefined,
  clearingRunId: string | undefined
): boolean {
  if (!activeRunId) return true;
  if (!clearingRunId) return false;
  return activeRunId === clearingRunId;
}

/**
 * State machine / reducer for managing shared AI activity state across runs.
 */
export interface AiActivityState {
  activeRunId: string | null;
  status: TaskStatusPayload | null;
  isGenerating: boolean;
  lastTimestamp: number;
}

export function createInitialAiActivityState(): AiActivityState {
  return {
    activeRunId: null,
    status: null,
    isGenerating: false,
    lastTimestamp: 0,
  };
}

/**
 * Applies an incoming status update to the AI activity state.
 * Prevents stale updates from overwriting newer runs, and ensures one run cannot clear another.
 */
export function applyAiStatusUpdate(
  currentState: AiActivityState,
  payload: unknown,
  expectedProjectId?: string
): { nextState: AiActivityState; accepted: boolean; reason?: string } {
  // 1. Validate structure
  const parseResult = TaskStatusPayloadSchema.safeParse(payload);
  if (!parseResult.success) {
    return {
      nextState: currentState,
      accepted: false,
      reason: `Malformed payload: ${parseResult.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join(", ")}`,
    };
  }

  const data = parseResult.data;

  // 2. Verify project association
  if (expectedProjectId && data.projectId !== expectedProjectId) {
    return {
      nextState: currentState,
      accepted: false,
      reason: `Mismatched projectId: expected '${expectedProjectId}', got '${data.projectId}'`,
    };
  }

  const isIncomingActive = isTaskStatusActive(data);
  const incomingTimestamp = data.timestamp || Date.now();

  // 3. Handle clearing / completion events (thinking: false or completed/failed/cancelled)
  if (!isIncomingActive) {
    // Check if this run is allowed to clear the current active run
    if (currentState.activeRunId && data.runId !== currentState.activeRunId) {
      return {
        nextState: currentState,
        accepted: false,
        reason: `Cannot clear activity: incoming runId '${data.runId}' does not match active runId '${currentState.activeRunId}'`,
      };
    }

    // Only clear if active run matches or if no active run
    return {
      nextState: {
        activeRunId: null,
        status: data,
        isGenerating: false,
        lastTimestamp: Math.max(currentState.lastTimestamp, incomingTimestamp),
      },
      accepted: true,
    };
  }

  // 4. Handle active progress events
  if (currentState.activeRunId && currentState.activeRunId !== data.runId) {
    // A newer run can supersede an older run if its timestamp is equal or newer
    if (currentState.lastTimestamp && incomingTimestamp < currentState.lastTimestamp) {
      return {
        nextState: currentState,
        accepted: false,
        reason: `Stale run: incoming run '${data.runId}' is older than active run '${currentState.activeRunId}'`,
      };
    }
  } else if (
    currentState.activeRunId === data.runId &&
    currentState.lastTimestamp &&
    incomingTimestamp < currentState.lastTimestamp
  ) {
    // Stale update within the same run
    return {
      nextState: currentState,
      accepted: false,
      reason: `Stale update: incoming timestamp (${incomingTimestamp}) < lastTimestamp (${currentState.lastTimestamp})`,
    };
  }

  // Accept active progress update
  return {
    nextState: {
      activeRunId: data.runId,
      status: data,
      isGenerating: true,
      lastTimestamp: Math.max(currentState.lastTimestamp, incomingTimestamp),
    },
    accepted: true,
  };
}
