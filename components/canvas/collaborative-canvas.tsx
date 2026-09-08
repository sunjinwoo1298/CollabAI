"use client";

import React, { useCallback, useRef, useState, useMemo, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  Panel,
} from "@xyflow/react";
import {
  Plus,
  Server,
  Database,
  Zap,
  Layers,
  Network,
  HardDrive,
  Monitor,
  Box,
  Trash2,
  Maximize2,
  Users,
  Wifi,
  WifiOff,
  RefreshCw,
  Sparkles,
  GripVertical,
} from "lucide-react";
import { useYjsRoom } from "@/hooks/useYjsRoom";
import { useCanvasSync } from "@/hooks/useCanvasSync";
import { SystemNode } from "@/components/canvas/nodes/system-node";
import { CollaboratorCursors } from "@/components/canvas/cursors/collaborator-cursor";
import { CanvasNode, CanvasNodeType } from "@/types/canvas";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CollaborativeCanvasProps {
  projectId: string;
  isOwner?: boolean;
}

const nodeTypes = {
  system: SystemNode,
};

export const NODE_PRESETS: Array<{
  type: CanvasNodeType;
  label: string;
  sublabel: string;
  description: string;
  icon: typeof Server;
}> = [
  {
    type: "client",
    label: "Web App Client",
    sublabel: "Next.js / React Frontend",
    description: "User-facing web client application",
    icon: Monitor,
  },
  {
    type: "gateway",
    label: "API Gateway",
    sublabel: "Reverse Proxy & Router",
    description: "Routes traffic, rate limits, and terminates TLS",
    icon: Network,
  },
  {
    type: "service",
    label: "Backend Service",
    sublabel: "Core Application Server",
    description: "Handles business logic and data processing",
    icon: Server,
  },
  {
    type: "database",
    label: "PostgreSQL DB",
    sublabel: "Relational Database",
    description: "Primary persistent relational storage",
    icon: Database,
  },
  {
    type: "cache",
    label: "Redis Cache",
    sublabel: "In-Memory Key-Value",
    description: "High-speed caching & pub/sub layer",
    icon: Zap,
  },
  {
    type: "queue",
    label: "Message Queue",
    sublabel: "Kafka / RabbitMQ",
    description: "Asynchronous task and event broker",
    icon: Layers,
  },
  {
    type: "storage",
    label: "Object Storage",
    sublabel: "AWS S3 / Blob Store",
    description: "Scalable static asset and file store",
    icon: HardDrive,
  },
];

function CollaborativeCanvasInner({ projectId }: CollaborativeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  const { screenToFlowPosition, fitView } = useReactFlow();

  // 1. Establish Yjs room connection
  const {
    doc,
    provider,
    awareness,
    connectionState,
    nodesMap,
    edgesMap,
    error: roomError,
    reconnect,
    updatePresence,
  } = useYjsRoom(projectId);

  // 2. Synchronize Canvas State with Yjs
  const {
    nodes,
    edges,
    collaborators,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    clearCanvas,
  } = useCanvasSync({
    doc,
    nodesMap,
    edgesMap,
    awareness,
    updatePresence,
  });

  // 3. Throttled Pointer move listener for broadcasting ephemeral cursor (~30fps)
  const lastBroadcastRef = useRef<number>(0);
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!awareness) return;

      const flowPos = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const nextCursor = {
        x: Math.round(flowPos.x),
        y: Math.round(flowPos.y),
      };

      pendingCursorRef.current = nextCursor;

      const now = performance.now();
      // Throttle awareness broadcast to ~30ms to avoid websocket flooding
      if (now - lastBroadcastRef.current >= 30) {
        lastBroadcastRef.current = now;
        updatePresence({ cursor: nextCursor });
      } else if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          lastBroadcastRef.current = performance.now();
          if (pendingCursorRef.current) {
            updatePresence({ cursor: pendingCursorRef.current });
          }
        });
      }
    },
    [awareness, screenToFlowPosition, updatePresence]
  );

  const handlePointerLeave = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingCursorRef.current = null;
    updatePresence({ cursor: null });
  }, [updatePresence]);

  // Clean up pointer broadcast on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      updatePresence({ cursor: null });
    };
  }, [updatePresence]);

  // 4. Node Creation Helper
  const createNodeAtPosition = useCallback(
    (preset: (typeof NODE_PRESETS)[number], position: { x: number; y: number }) => {
      const nodeId = `node-${preset.type}-${Date.now().toString(36)}`;
      const newNode: CanvasNode = {
        id: nodeId,
        type: "system",
        position,
        data: {
          label: preset.label,
          sublabel: preset.sublabel,
          nodeType: preset.type,
          description: preset.description,
          status: "active",
        },
      };

      addNode(newNode);
    },
    [addNode]
  );

  // Quick-add node at viewport center (on click)
  const handleAddNode = useCallback(
    (preset: (typeof NODE_PRESETS)[number]) => {
      const bounds = containerRef.current?.getBoundingClientRect();
      const centerX = bounds ? bounds.left + bounds.width / 2 : window.innerWidth / 2;
      const centerY = bounds ? bounds.top + bounds.height / 2 : window.innerHeight / 2;

      const flowCenter = screenToFlowPosition({
        x: centerX,
        y: centerY,
      });

      const randomJitterX = Math.floor(Math.random() * 60 - 30);
      const randomJitterY = Math.floor(Math.random() * 60 - 30);

      createNodeAtPosition(preset, {
        x: Math.round(flowCenter.x - 100 + randomJitterX),
        y: Math.round(flowCenter.y - 45 + randomJitterY),
      });

      setIsAddMenuOpen(false);
    },
    [screenToFlowPosition, createNodeAtPosition]
  );

  // 5. Drag & Drop Pipeline Handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, preset: (typeof NODE_PRESETS)[number]) => {
      e.dataTransfer.setData("application/reactflow", JSON.stringify(preset));
      e.dataTransfer.setData("text/plain", preset.type);
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      const rawData =
        e.dataTransfer.getData("application/reactflow") ||
        e.dataTransfer.getData("text/plain");

      if (!rawData) return;

      let preset: (typeof NODE_PRESETS)[number] | undefined;

      try {
        const parsed = JSON.parse(rawData);
        if (parsed.type) {
          preset = NODE_PRESETS.find((p) => p.type === parsed.type) || parsed;
        }
      } catch {
        preset = NODE_PRESETS.find((p) => p.type === rawData);
      }

      if (!preset) return;

      const position = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      createNodeAtPosition(preset, {
        x: Math.round(position.x - 100),
        y: Math.round(position.y - 40),
      });
    },
    [screenToFlowPosition, createNodeAtPosition]
  );

  // Connection status pill details
  const connectionBadge = useMemo(() => {
    switch (connectionState) {
      case "connected":
        return {
          label: "Live",
          color: "bg-emerald-500",
          textColor: "text-emerald-400",
          bgColor: "bg-emerald-500/10 border-emerald-500/20",
          icon: Wifi,
        };
      case "connecting":
        return {
          label: "Connecting...",
          color: "bg-amber-500 animate-ping",
          textColor: "text-amber-400",
          bgColor: "bg-amber-500/10 border-amber-500/20",
          icon: RefreshCw,
        };
      case "unauthorized":
        return {
          label: "Unauthorized",
          color: "bg-rose-500",
          textColor: "text-rose-400",
          bgColor: "bg-rose-500/10 border-rose-500/20",
          icon: WifiOff,
        };
      default:
        return {
          label: "Offline",
          color: "bg-rose-500",
          textColor: "text-rose-400",
          bgColor: "bg-rose-500/10 border-rose-500/20",
          icon: WifiOff,
        };
    }
  }, [connectionState]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full bg-base overflow-hidden select-none"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2.5}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: true,
          style: { stroke: "#64748B", strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        {/* Infinite Background Dot Grid */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color="#2A3447"
        />

        {/* Pan/Zoom Controls */}
        <Controls
          showInteractive={false}
          position="bottom-left"
          className="!m-4 !border !border-default !bg-surface/90 !backdrop-blur-md !rounded-xl !shadow-xl"
        />

        {/* MiniMap Overview */}
        <MiniMap
          position="bottom-right"
          nodeStrokeWidth={3}
          nodeColor={(node) => {
            const data = node.data as any;
            if (data?.nodeType === "database") return "#3B82F6";
            if (data?.nodeType === "cache") return "#F59E0B";
            if (data?.nodeType === "queue") return "#A855F7";
            if (data?.nodeType === "gateway") return "#F43F5E";
            if (data?.nodeType === "storage") return "#06B6D4";
            if (data?.nodeType === "client") return "#6366F1";
            return "#10B981";
          }}
          className="!m-4 !rounded-xl !overflow-hidden !border !border-default !bg-surface/90 !backdrop-blur-md"
        />

        {/* Collaborator Cursors Overlay */}
        <CollaboratorCursors collaborators={collaborators} />

        {/* Top-Floating Action Toolbar Panel */}
        <Panel position="top-left" className="!m-4 !z-30 flex items-center gap-2">
          {/* Add Component Menu & Draggable Palette */}
          <div className="relative">
            <Button
              size="sm"
              onClick={() => setIsAddMenuOpen((prev) => !prev)}
              className="h-9 px-3 gap-1.5 bg-brand hover:bg-brand/90 text-primary-foreground font-semibold shadow-lg shadow-brand/20 rounded-xl cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Node</span>
            </Button>

            {isAddMenuOpen && (
              <div
                className="absolute left-0 top-11 w-64 p-2 rounded-2xl bg-surface/95 border border-default shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center justify-between">
                  <span>Architecture Nodes</span>
                  <span className="text-[9px] text-faint lowercase font-normal">Click or drag</span>
                </div>
                <div className="space-y-1 mt-1">
                  {NODE_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    return (
                      <div
                        key={preset.type}
                        draggable
                        onDragStart={(e) => handleDragStart(e, preset)}
                        onClick={() => handleAddNode(preset)}
                        className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-primary hover:bg-subtle hover:text-white transition-all cursor-grab active:cursor-grabbing border border-transparent hover:border-default/60 select-none"
                      >
                        <div className="h-7 w-7 rounded-lg bg-subtle border border-default flex items-center justify-center shrink-0 text-secondary group-hover:text-brand group-hover:border-brand/40 transition-colors">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-semibold text-primary">
                            {preset.label}
                          </div>
                          <div className="text-[10px] text-muted truncate">
                            {preset.sublabel}
                          </div>
                        </div>
                        <GripVertical className="h-3.5 w-3.5 text-faint group-hover:text-muted shrink-0 opacity-40 group-hover:opacity-100" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Fit View Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => fitView({ duration: 300 })}
            className="h-9 w-9 bg-surface/80 hover:bg-subtle border-default text-muted hover:text-primary rounded-xl shadow-lg backdrop-blur-md"
            title="Fit View"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>

          {/* Clear Canvas Action */}
          {nodes.length > 0 && (
            <div className="relative">
              {!isConfirmClearOpen ? (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsConfirmClearOpen(true)}
                  className="h-9 w-9 bg-surface/80 hover:bg-error/10 hover:text-error hover:border-error/30 border-default text-muted rounded-xl shadow-lg backdrop-blur-md transition-colors"
                  title="Clear Canvas"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : (
                <div
                  className="flex items-center gap-1 bg-surface border border-error/40 p-1 rounded-xl shadow-2xl backdrop-blur-xl"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      clearCanvas();
                      setIsConfirmClearOpen(false);
                    }}
                    className="h-7 px-2 text-xs"
                  >
                    Confirm Clear
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsConfirmClearOpen(false)}
                    className="h-7 px-2 text-xs text-muted hover:text-primary"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </Panel>

        {/* Top-Right Collaboration & Connection Status Panel */}
        <Panel position="top-right" className="!m-4 !z-30 flex items-center gap-2">
          {/* Active Collaborators Presence List */}
          {collaborators.length > 0 && (
            <div className="flex items-center gap-1 bg-surface/90 border border-default px-2.5 py-1 rounded-xl shadow-xl backdrop-blur-md">
              <Users className="h-3.5 w-3.5 text-muted mr-1" />
              <div className="flex -space-x-2 overflow-hidden">
                {collaborators.map((collab) => {
                  const userColor = collab.user?.color || "#10B981";
                  const userName = collab.user?.name || "Peer";
                  return (
                    <div
                      key={collab.clientId}
                      className="relative group/avatar"
                      title={userName}
                    >
                      {collab.user.avatar ? (
                        <img
                          src={collab.user.avatar}
                          alt={userName}
                          className="h-6 w-6 rounded-full border-2 border-surface object-cover shadow-sm"
                        />
                      ) : (
                        <div
                          className="h-6 w-6 rounded-full border-2 border-surface flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                          style={{ backgroundColor: userColor }}
                        >
                          {userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <span className="text-xs font-medium text-secondary pl-1">
                {collaborators.length + 1} online
              </span>
            </div>
          )}

          {/* Real-time Connection State Pill */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium shadow-xl backdrop-blur-md transition-all",
              connectionBadge.bgColor,
              connectionBadge.textColor
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", connectionBadge.color)} />
            <span>{connectionBadge.label}</span>

            {connectionState === "disconnected" && (
              <button
                onClick={reconnect}
                type="button"
                className="ml-1 text-[11px] underline hover:text-white transition-colors cursor-pointer"
              >
                Reconnect
              </button>
            )}
          </div>
        </Panel>

        {/* Empty Canvas Quick Guide Overlay */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            <div className="pointer-events-auto max-w-sm w-full mx-4 p-6 rounded-2xl bg-surface/90 border border-default shadow-2xl backdrop-blur-md text-center space-y-4">
              <div className="h-12 w-12 rounded-xl bg-subtle border border-default flex items-center justify-center mx-auto text-brand">
                <Sparkles className="h-6 w-6 text-brand" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-semibold text-primary">
                  Interactive Collaborative Canvas
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  Start designing your architecture by adding or dragging system nodes onto the canvas.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => handleAddNode(NODE_PRESETS[0])}
                  className="h-8 text-xs bg-subtle hover:bg-subtle/80 border border-default text-primary hover:border-brand/40 justify-start px-2.5"
                >
                  <Monitor className="h-3.5 w-3.5 text-indigo-400 mr-2" />
                  Add Client
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAddNode(NODE_PRESETS[2])}
                  className="h-8 text-xs bg-subtle hover:bg-subtle/80 border border-default text-primary hover:border-brand/40 justify-start px-2.5"
                >
                  <Server className="h-3.5 w-3.5 text-emerald-400 mr-2" />
                  Add Service
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAddNode(NODE_PRESETS[3])}
                  className="h-8 text-xs bg-subtle hover:bg-subtle/80 border border-default text-primary hover:border-brand/40 justify-start px-2.5"
                >
                  <Database className="h-3.5 w-3.5 text-blue-400 mr-2" />
                  Add Database
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAddNode(NODE_PRESETS[4])}
                  className="h-8 text-xs bg-subtle hover:bg-subtle/80 border border-default text-primary hover:border-brand/40 justify-start px-2.5"
                >
                  <Zap className="h-3.5 w-3.5 text-amber-400 mr-2" />
                  Add Cache
                </Button>
              </div>
            </div>
          </div>
        )}
      </ReactFlow>
    </div>
  );
}

export function CollaborativeCanvas(props: CollaborativeCanvasProps) {
  return (
    <ReactFlowProvider>
      <CollaborativeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

export default CollaborativeCanvas;
