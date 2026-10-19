import { z } from "zod";
import { CanvasNodeType } from "@/types/canvas";

export const ALLOWED_NODE_TYPES: [CanvasNodeType, ...CanvasNodeType[]] = [
  "service",
  "database",
  "cache",
  "queue",
  "gateway",
  "storage",
  "client",
  "custom",
];

export const ALLOWED_SOURCE_HANDLES = [
  "source-top",
  "source-bottom",
  "source-left",
  "source-right",
] as const;

export const ALLOWED_TARGET_HANDLES = [
  "target-top",
  "target-bottom",
  "target-left",
  "target-right",
] as const;

// 1. Individual Operation Schemas
export const AddNodeOperationSchema = z.object({
  type: z.literal("add_node"),
  id: z.string().min(1, "Node id cannot be empty"),
  nodeType: z.enum(ALLOWED_NODE_TYPES),
  label: z.string().min(1, "Node label cannot be empty"),
  sublabel: z.string().optional(),
  description: z.string().optional(),
  position: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
  }),
  status: z.enum(["active", "idle", "error"]).optional(),
  tech: z.string().optional(),
  width: z.number().finite().positive().optional(),
  height: z.number().finite().positive().optional(),
});

export const MoveNodeOperationSchema = z.object({
  type: z.literal("move_node"),
  id: z.string().min(1, "Target node id required"),
  position: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
  }),
});

export const ResizeNodeOperationSchema = z.object({
  type: z.literal("resize_node"),
  id: z.string().min(1, "Target node id required"),
  width: z.number().finite().min(100).max(800),
  height: z.number().finite().min(60).max(600),
});

export const UpdateNodeOperationSchema = z.object({
  type: z.literal("update_node"),
  id: z.string().min(1, "Target node id required"),
  label: z.string().optional(),
  sublabel: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["active", "idle", "error"]).optional(),
  tech: z.string().optional(),
});

export const DeleteNodeOperationSchema = z.object({
  type: z.literal("delete_node"),
  id: z.string().min(1, "Target node id required"),
});

export const AddEdgeOperationSchema = z.object({
  type: z.literal("add_edge"),
  id: z.string().min(1, "Edge id required"),
  source: z.string().min(1, "Edge source required"),
  target: z.string().min(1, "Edge target required"),
  sourceHandle: z.enum(ALLOWED_SOURCE_HANDLES).optional(),
  targetHandle: z.enum(ALLOWED_TARGET_HANDLES).optional(),
  label: z.string().optional(),
  animated: z.boolean().optional(),
});

export const DeleteEdgeOperationSchema = z.object({
  type: z.literal("delete_edge"),
  id: z.string().min(1, "Target edge id required"),
});

export const DesignOperationSchema = z.discriminatedUnion("type", [
  AddNodeOperationSchema,
  MoveNodeOperationSchema,
  ResizeNodeOperationSchema,
  UpdateNodeOperationSchema,
  DeleteNodeOperationSchema,
  AddEdgeOperationSchema,
  DeleteEdgeOperationSchema,
]);

export type DesignOperation = z.infer<typeof DesignOperationSchema>;

export const DesignPlanSchema = z.object({
  summary: z.string().min(1, "Summary is required"),
  operations: z.array(DesignOperationSchema).max(50, "Plan cannot exceed 50 operations"),
});

export type DesignPlan = z.infer<typeof DesignPlanSchema>;

export interface PlanValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates the semantic consistency of a generated plan before application.
 * Verifies that edges refer to existing or newly created nodes, operation IDs are unique,
 * and operations conform to spatial and schema constraints.
 */
export function validateDesignPlan(
  plan: unknown,
  existingNodeIds: Set<string> = new Set(),
  existingEdgeIds: Set<string> = new Set()
): PlanValidationResult {
  const errors: string[] = [];

  const parsed = DesignPlanSchema.safeParse(plan);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`[${issue.path.join(".")}] ${issue.message}`);
    }
    return { valid: false, errors };
  }

  const { operations } = parsed.data;

  // Track nodes available during plan execution
  const activeNodeIds = new Set<string>(existingNodeIds);
  const activeEdgeIds = new Set<string>(existingEdgeIds);
  const seenOperationNodeIds = new Set<string>();
  const seenOperationEdgeIds = new Set<string>();

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    switch (op.type) {
      case "add_node": {
        if (seenOperationNodeIds.has(op.id) || activeNodeIds.has(op.id)) {
          errors.push(`Operation ${i} (add_node): Duplicate node ID '${op.id}'`);
        }
        seenOperationNodeIds.add(op.id);
        activeNodeIds.add(op.id);
        break;
      }
      case "move_node":
      case "resize_node":
      case "update_node": {
        if (!activeNodeIds.has(op.id)) {
          errors.push(`Operation ${i} (${op.type}): Target node '${op.id}' does not exist`);
        }
        break;
      }
      case "delete_node": {
        if (!activeNodeIds.has(op.id)) {
          errors.push(`Operation ${i} (delete_node): Target node '${op.id}' does not exist`);
        }
        activeNodeIds.delete(op.id);
        break;
      }
      case "add_edge": {
        if (seenOperationEdgeIds.has(op.id) || activeEdgeIds.has(op.id)) {
          errors.push(`Operation ${i} (add_edge): Duplicate edge ID '${op.id}'`);
        }
        if (!activeNodeIds.has(op.source)) {
          errors.push(
            `Operation ${i} (add_edge): Source node '${op.source}' does not exist in canvas or plan`
          );
        }
        if (!activeNodeIds.has(op.target)) {
          errors.push(
            `Operation ${i} (add_edge): Target node '${op.target}' does not exist in canvas or plan`
          );
        }
        if (op.source === op.target) {
          errors.push(
            `Operation ${i} (add_edge): Self-referential edge from '${op.source}' to itself is not permitted`
          );
        }
        seenOperationEdgeIds.add(op.id);
        activeEdgeIds.add(op.id);
        break;
      }
      case "delete_edge": {
        if (!activeEdgeIds.has(op.id)) {
          errors.push(`Operation ${i} (delete_edge): Target edge '${op.id}' does not exist`);
        }
        activeEdgeIds.delete(op.id);
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
