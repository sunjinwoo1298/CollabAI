"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import * as Y from "yjs";
import {
  NodeChange,
  EdgeChange,
  Connection,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import { Awareness } from "y-protocols/awareness";
import { CanvasNode, CanvasEdge, RemoteCollaborator, SystemNodeData } from "@/types/canvas";
import { UserPresence } from "@/types/collaboration";
import { CanvasTemplate } from "@/components/editor/starter-templates";

interface UseCanvasSyncOptions {
  doc: Y.Doc;
  nodesMap: Y.Map<any>;
  edgesMap: Y.Map<any>;
  awareness: Awareness | null;
  updatePresence: (presence: Partial<UserPresence>) => void;
}

export interface UseCanvasSyncResult {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  collaborators: RemoteCollaborator[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: CanvasNode) => void;
  deleteNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<SystemNodeData>) => void;
  clearCanvas: () => void;
  loadTemplate: (template: CanvasTemplate) => void;
  setNodes: React.Dispatch<React.SetStateAction<CanvasNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<CanvasEdge[]>>;
}

export function useCanvasSync({
  doc,
  nodesMap,
  edgesMap,
  awareness,
  updatePresence,
}: UseCanvasSyncOptions): UseCanvasSyncResult {
  const [nodes, setNodes] = useState<CanvasNode[]>(() => {
    return Array.from(nodesMap.values()) as CanvasNode[];
  });
  const [edges, setEdges] = useState<CanvasEdge[]>(() => {
    return Array.from(edgesMap.values()) as CanvasEdge[];
  });
  const [collaborators, setCollaborators] = useState<RemoteCollaborator[]>([]);

  const isLocalTransactionRef = useRef(false);

  // 1. Synchronize Yjs maps -> React state
  useEffect(() => {
    // Initial hydration from Y.Doc
    const currentNodes = Array.from(nodesMap.values()) as CanvasNode[];
    const currentEdges = Array.from(edgesMap.values()) as CanvasEdge[];
    setNodes(currentNodes);
    setEdges(currentEdges);

    const handleNodesChange = () => {
      const nextNodes = Array.from(nodesMap.values()) as CanvasNode[];
      setNodes(nextNodes);
    };

    const handleEdgesChange = () => {
      const nextEdges = Array.from(edgesMap.values()) as CanvasEdge[];
      setEdges(nextEdges);
    };

    nodesMap.observe(handleNodesChange);
    edgesMap.observe(handleEdgesChange);

    return () => {
      nodesMap.unobserve(handleNodesChange);
      edgesMap.unobserve(handleEdgesChange);
    };
  }, [nodesMap, edgesMap]);

  // 2. Awareness synchronization for collaborator cursors and presence
  useEffect(() => {
    if (!awareness) return;

    const updateCollaborators = () => {
      const states = awareness.getStates();
      const peerList: RemoteCollaborator[] = [];

      states.forEach((state: any, client: number) => {
        // Only include remote peers who have user metadata
        if (client !== awareness.clientID && state?.user) {
          peerList.push({
            clientId: client,
            user: state.user,
            cursor: state.presence?.cursor || null,
            isThinking: Boolean(state.presence?.isThinking),
          });
        }
      });

      setCollaborators(peerList);
    };

    updateCollaborators();
    awareness.on("change", updateCollaborators);

    return () => {
      awareness.off("change", updateCollaborators);
    };
  }, [awareness]);

  // 3. React Flow -> Yjs: Node Changes (position drag, delete, select)
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Optimistically apply changes locally for smooth 60fps dragging and selection
      setNodes((nds) => applyNodeChanges(changes, nds) as CanvasNode[]);

      // Check if there are changes that mutate canonical state
      const hasMutations = changes.some(
        (c) => c.type === "position" || c.type === "remove" || c.type === "replace"
      );

      if (!hasMutations) return;

      isLocalTransactionRef.current = true;
      try {
        doc.transact(() => {
          for (const change of changes) {
            if (change.type === "position" && change.position) {
              const existingNode = nodesMap.get(change.id) as CanvasNode | undefined;
              if (existingNode) {
                nodesMap.set(change.id, {
                  ...existingNode,
                  position: change.position,
                });
              }
            } else if (change.type === "remove") {
              nodesMap.delete(change.id);

              // Cascade delete connected edges
              for (const [edgeId, edge] of edgesMap.entries() as Iterable<[string, CanvasEdge]>) {
                if (edge.source === change.id || edge.target === change.id) {
                  edgesMap.delete(edgeId);
                }
              }
            }
          }
        }, "local-ui-nodes");
      } finally {
        isLocalTransactionRef.current = false;
      }
    },
    [doc, nodesMap, edgesMap]
  );

  // 4. React Flow -> Yjs: Edge Changes (remove, select)
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Optimistically apply edge changes locally
      setEdges((eds) => applyEdgeChanges(changes, eds) as CanvasEdge[]);

      const hasRemovals = changes.some((c) => c.type === "remove");
      if (!hasRemovals) return;

      isLocalTransactionRef.current = true;
      try {
        doc.transact(() => {
          for (const change of changes) {
            if (change.type === "remove") {
              edgesMap.delete(change.id);
            }
          }
        }, "local-ui-edges");
      } finally {
        isLocalTransactionRef.current = false;
      }
    },
    [doc, edgesMap]
  );

  // 5. React Flow -> Yjs: On Connect (creating a new edge)
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const edgeId = `e-${connection.source}-${connection.sourceHandle || "default"}-${connection.target}-${connection.targetHandle || "default"}-${Date.now().toString(36)}`;

      const newEdge: CanvasEdge = {
        id: edgeId,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#64748B", strokeWidth: 2 },
      };

      isLocalTransactionRef.current = true;
      try {
        doc.transact(() => {
          edgesMap.set(edgeId, newEdge);
        }, "local-edge-connect");
      } finally {
        isLocalTransactionRef.current = false;
      }
    },
    [doc, edgesMap]
  );

  // 6. Explicit programmatic helper actions
  const addNode = useCallback(
    (node: CanvasNode) => {
      isLocalTransactionRef.current = true;
      try {
        doc.transact(() => {
          nodesMap.set(node.id, node);
        }, "local-add-node");
      } finally {
        isLocalTransactionRef.current = false;
      }
    },
    [doc, nodesMap]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      isLocalTransactionRef.current = true;
      try {
        doc.transact(() => {
          nodesMap.delete(nodeId);
          for (const [edgeId, edge] of edgesMap.entries() as Iterable<[string, CanvasEdge]>) {
            if (edge.source === nodeId || edge.target === nodeId) {
              edgesMap.delete(edgeId);
            }
          }
        }, "local-delete-node");
      } finally {
        isLocalTransactionRef.current = false;
      }
    },
    [doc, nodesMap, edgesMap]
  );

  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<SystemNodeData>) => {
      isLocalTransactionRef.current = true;
      try {
        doc.transact(() => {
          const existing = nodesMap.get(nodeId) as CanvasNode | undefined;
          if (existing) {
            nodesMap.set(nodeId, {
              ...existing,
              data: {
                ...existing.data,
                ...data,
              },
            });
          }
        }, "local-update-node-data");
      } finally {
        isLocalTransactionRef.current = false;
      }
    },
    [doc, nodesMap]
  );

  const clearCanvas = useCallback(() => {
    isLocalTransactionRef.current = true;
    try {
      doc.transact(() => {
        for (const key of Array.from(nodesMap.keys())) {
          nodesMap.delete(key);
        }
        for (const key of Array.from(edgesMap.keys())) {
          edgesMap.delete(key);
        }
      }, "local-clear-canvas");
    } finally {
      isLocalTransactionRef.current = false;
    }
  }, [doc, nodesMap, edgesMap]);

  const loadTemplate = useCallback(
    (template: CanvasTemplate) => {
      isLocalTransactionRef.current = true;
      try {
        doc.transact(() => {
          // 1. Clear all existing nodes and edges
          for (const key of Array.from(nodesMap.keys())) {
            nodesMap.delete(key);
          }
          for (const key of Array.from(edgesMap.keys())) {
            edgesMap.delete(key);
          }

          // 2. Add all template nodes and edges in the same transaction
          for (const node of template.nodes) {
            nodesMap.set(node.id, node);
          }
          for (const edge of template.edges) {
            edgesMap.set(edge.id, edge);
          }
        }, "local-load-template");
      } finally {
        isLocalTransactionRef.current = false;
      }
    },
    [doc, nodesMap, edgesMap]
  );

  return {
    nodes,
    edges,
    collaborators,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    deleteNode,
    updateNodeData,
    clearCanvas,
    loadTemplate,
    setNodes,
    setEdges,
  };
}
