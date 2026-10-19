import * as Y from "yjs";
import { CanvasNode, CanvasEdge, CanvasNodeType } from "@/types/canvas";
import { DesignPlan, DesignOperation } from "./design-schema";
import { NodeSummary, EdgeSummary } from "./gemini-planner";

export interface CanvasSnapshot {
  nodes: Map<string, CanvasNode>;
  edges: Map<string, CanvasEdge>;
  nodeSummaries: NodeSummary[];
  edgeSummaries: EdgeSummary[];
  boundingBox: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    centerX: number;
    centerY: number;
  };
}

export interface MutationApplicationResult {
  appliedCount: number;
  skippedCount: number;
  skippedDetails: Array<{ opIndex: number; type: string; reason: string }>;
  runAlreadyApplied: boolean;
}

/**
 * Phase 1: Takes an immutable snapshot of current canvas state before planning.
 */
export function takeCanvasSnapshot(
  nodesMap: Y.Map<any>,
  edgesMap: Y.Map<any>
): CanvasSnapshot {
  const nodes = new Map<string, CanvasNode>();
  const edges = new Map<string, CanvasEdge>();
  const nodeSummaries: NodeSummary[] = [];
  const edgeSummaries: EdgeSummary[] = [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [id, node] of nodesMap.entries() as Iterable<[string, CanvasNode]>) {
    if (!node || !node.position) continue;
    // Deep copy node to decouple from future live mutations
    const copiedNode: CanvasNode = JSON.parse(JSON.stringify(node));
    nodes.set(id, copiedNode);

    const x = copiedNode.position.x;
    const y = copiedNode.position.y;
    const width = (copiedNode as any).width || (copiedNode.style as any)?.width || 220;
    const height = (copiedNode as any).height || (copiedNode.style as any)?.height || 100;

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + width);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + height);

    nodeSummaries.push({
      id: copiedNode.id,
      type: copiedNode.data?.nodeType || "service",
      label: copiedNode.data?.label || copiedNode.id,
      sublabel: copiedNode.data?.sublabel,
      x,
      y,
      width: Number(width),
      height: Number(height),
      description: copiedNode.data?.description,
    });
  }

  for (const [id, edge] of edgesMap.entries() as Iterable<[string, CanvasEdge]>) {
    if (!edge || !edge.source || !edge.target) continue;
    const copiedEdge: CanvasEdge = JSON.parse(JSON.stringify(edge));
    edges.set(id, copiedEdge);

    edgeSummaries.push({
      id: copiedEdge.id,
      source: copiedEdge.source,
      target: copiedEdge.target,
      label: typeof copiedEdge.label === "string" ? copiedEdge.label : undefined,
    });
  }

  const hasNodes = nodes.size > 0;
  const boundingBox = {
    minX: hasNodes ? minX : 0,
    maxX: hasNodes ? maxX : 0,
    minY: hasNodes ? minY : 0,
    maxY: hasNodes ? maxY : 0,
    centerX: hasNodes ? Math.round((minX + maxX) / 2) : 400,
    centerY: hasNodes ? Math.round((minY + maxY) / 2) : 250,
  };

  return {
    nodes,
    edges,
    nodeSummaries,
    edgeSummaries,
    boundingBox,
  };
}

export interface ApplyPlanOptions {
  doc: Y.Doc;
  nodesMap: Y.Map<any>;
  edgesMap: Y.Map<any>;
  plan: DesignPlan;
  snapshot: CanvasSnapshot;
  runId?: string;
}

/**
 * Phase 3: Validate & Apply Phase
 * Applies mutations atomically inside a single synchronous doc.transact().
 * Revalidates against current live state, applies relative movement offsets,
 * cascades edge deletions, and enforces run-level idempotency.
 */
export function applyDesignPlan({
  doc,
  nodesMap,
  edgesMap,
  plan,
  snapshot,
  runId,
}: ApplyPlanOptions): MutationApplicationResult {
  const result: MutationApplicationResult = {
    appliedCount: 0,
    skippedCount: 0,
    skippedDetails: [],
    runAlreadyApplied: false,
  };

  doc.transact(() => {
    // 1. Idempotency Check: prevent duplicate application on task retries
    const appliedRuns = doc.getMap<any>("ai-runs");
    if (runId && appliedRuns.has(runId)) {
      result.runAlreadyApplied = true;
      result.skippedCount = plan.operations.length;
      result.skippedDetails.push({
        opIndex: -1,
        type: "all",
        reason: `Task run '${runId}' has already been applied to this canvas. Skipping duplicate execution.`,
      });
      return;
    }

    // 2. Sequentially validate and apply each operation against live CRDT state
    for (let i = 0; i < plan.operations.length; i++) {
      const op = plan.operations[i];

      switch (op.type) {
        case "add_node": {
          let targetNodeId = op.id;
          // If node ID collides with existing live node, append suffix
          if (nodesMap.has(targetNodeId)) {
            targetNodeId = `${op.id}-${Date.now().toString(36)}`;
          }

          const newNode: CanvasNode = {
            id: targetNodeId,
            type: "system",
            position: {
              x: op.position.x,
              y: op.position.y,
            },
            data: {
              label: op.label,
              sublabel: op.sublabel || op.nodeType,
              nodeType: op.nodeType,
              description: op.description,
              status: op.status || "active",
              metadata: op.tech ? { tech: op.tech } : undefined,
            },
          };

          nodesMap.set(targetNodeId, newNode);
          result.appliedCount++;
          break;
        }

        case "move_node": {
          const liveNode = nodesMap.get(op.id) as CanvasNode | undefined;
          if (!liveNode) {
            result.skippedCount++;
            result.skippedDetails.push({
              opIndex: i,
              type: "move_node",
              reason: `Target node '${op.id}' was deleted during planning phase. Skipping move.`,
            });
            break;
          }

          // Apply relative offset to preserve concurrent human drags during planning
          const snapNode = snapshot.nodes.get(op.id);
          if (snapNode) {
            const dx = op.position.x - snapNode.position.x;
            const dy = op.position.y - snapNode.position.y;
            nodesMap.set(op.id, {
              ...liveNode,
              position: {
                x: Math.round(liveNode.position.x + dx),
                y: Math.round(liveNode.position.y + dy),
              },
            });
          } else {
            nodesMap.set(op.id, {
              ...liveNode,
              position: op.position,
            });
          }

          result.appliedCount++;
          break;
        }

        case "resize_node": {
          const liveNode = nodesMap.get(op.id) as CanvasNode | undefined;
          if (!liveNode) {
            result.skippedCount++;
            result.skippedDetails.push({
              opIndex: i,
              type: "resize_node",
              reason: `Target node '${op.id}' was deleted during planning phase. Skipping resize.`,
            });
            break;
          }

          nodesMap.set(op.id, {
            ...liveNode,
            style: {
              ...(liveNode.style || {}),
              width: op.width,
              height: op.height,
            },
          });
          result.appliedCount++;
          break;
        }

        case "update_node": {
          const liveNode = nodesMap.get(op.id) as CanvasNode | undefined;
          if (!liveNode) {
            result.skippedCount++;
            result.skippedDetails.push({
              opIndex: i,
              type: "update_node",
              reason: `Target node '${op.id}' was deleted during planning phase. Skipping update.`,
            });
            break;
          }

          nodesMap.set(op.id, {
            ...liveNode,
            data: {
              ...liveNode.data,
              ...(op.label ? { label: op.label } : {}),
              ...(op.sublabel ? { sublabel: op.sublabel } : {}),
              ...(op.description ? { description: op.description } : {}),
              ...(op.status ? { status: op.status } : {}),
              metadata: {
                ...liveNode.data?.metadata,
                ...(op.tech ? { tech: op.tech } : {}),
              },
            },
          });
          result.appliedCount++;
          break;
        }

        case "delete_node": {
          const liveNode = nodesMap.get(op.id) as CanvasNode | undefined;
          if (!liveNode) {
            result.skippedCount++;
            result.skippedDetails.push({
              opIndex: i,
              type: "delete_node",
              reason: `Target node '${op.id}' was already deleted. Skipping delete.`,
            });
            break;
          }

          // Delete node
          nodesMap.delete(op.id);

          // Cascade delete connected edges
          for (const [edgeId, edge] of edgesMap.entries() as Iterable<[string, CanvasEdge]>) {
            if (edge.source === op.id || edge.target === op.id) {
              edgesMap.delete(edgeId);
            }
          }

          result.appliedCount++;
          break;
        }

        case "add_edge": {
          // Re-verify both endpoints exist in current live state
          const sourceExists = nodesMap.has(op.source);
          const targetExists = nodesMap.has(op.target);

          if (!sourceExists || !targetExists) {
            result.skippedCount++;
            result.skippedDetails.push({
              opIndex: i,
              type: "add_edge",
              reason: `Endpoint missing: source '${op.source}' exists: ${sourceExists}, target '${op.target}' exists: ${targetExists}`,
            });
            break;
          }

          // Check for existing duplicate edge
          let hasDuplicate = false;
          for (const e of edgesMap.values() as Iterable<CanvasEdge>) {
            if (e.source === op.source && e.target === op.target) {
              hasDuplicate = true;
              break;
            }
          }

          if (hasDuplicate) {
            result.skippedCount++;
            result.skippedDetails.push({
              opIndex: i,
              type: "add_edge",
              reason: `Edge connecting '${op.source}' to '${op.target}' already exists`,
            });
            break;
          }

          let targetEdgeId = op.id;
          if (edgesMap.has(targetEdgeId)) {
            targetEdgeId = `${op.id}-${Date.now().toString(36)}`;
          }

          const newEdge: CanvasEdge = {
            id: targetEdgeId,
            source: op.source,
            target: op.target,
            sourceHandle: op.sourceHandle || "source-right",
            targetHandle: op.targetHandle || "target-left",
            label: op.label,
            animated: op.animated !== undefined ? op.animated : true,
            type: "smoothstep",
            style: { stroke: "#64748B", strokeWidth: 2 },
          };

          edgesMap.set(targetEdgeId, newEdge);
          result.appliedCount++;
          break;
        }

        case "delete_edge": {
          if (!edgesMap.has(op.id)) {
            result.skippedCount++;
            result.skippedDetails.push({
              opIndex: i,
              type: "delete_edge",
              reason: `Edge '${op.id}' does not exist or was already deleted.`,
            });
            break;
          }

          edgesMap.delete(op.id);
          result.appliedCount++;
          break;
        }
      }
    }

    // 3. Record applied runId for idempotency
    if (runId) {
      appliedRuns.set(runId, {
        appliedAt: Date.now(),
        appliedCount: result.appliedCount,
        skippedCount: result.skippedCount,
      });
    }
  }, "ai-design-agent");

  return result;
}
