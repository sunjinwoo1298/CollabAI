"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import {
  Server,
  Database,
  Zap,
  Layers,
  Network,
  HardDrive,
  Monitor,
  Box,
  LucideIcon,
} from "lucide-react";
import { CanvasNodeType, SystemNodeData } from "@/types/canvas";
import { cn } from "@/lib/utils";

interface NodeTypeConfig {
  icon: LucideIcon;
  colorClass: string;
  badgeBg: string;
  badgeText: string;
  label: string;
}

const NODE_CONFIGS: Record<CanvasNodeType, NodeTypeConfig> = {
  service: {
    icon: Server,
    colorClass: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-300",
    label: "Service",
  },
  database: {
    icon: Database,
    colorClass: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    badgeBg: "bg-blue-500/15",
    badgeText: "text-blue-300",
    label: "Database",
  },
  cache: {
    icon: Zap,
    colorClass: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-300",
    label: "Cache",
  },
  queue: {
    icon: Layers,
    colorClass: "text-purple-400 border-purple-500/30 bg-purple-500/10",
    badgeBg: "bg-purple-500/15",
    badgeText: "text-purple-300",
    label: "Queue",
  },
  gateway: {
    icon: Network,
    colorClass: "text-rose-400 border-rose-500/30 bg-rose-500/10",
    badgeBg: "bg-rose-500/15",
    badgeText: "text-rose-300",
    label: "Gateway",
  },
  storage: {
    icon: HardDrive,
    colorClass: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
    badgeBg: "bg-cyan-500/15",
    badgeText: "text-cyan-300",
    label: "Storage",
  },
  client: {
    icon: Monitor,
    colorClass: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
    badgeBg: "bg-indigo-500/15",
    badgeText: "text-indigo-300",
    label: "Client",
  },
  custom: {
    icon: Box,
    colorClass: "text-slate-400 border-slate-500/30 bg-slate-500/10",
    badgeBg: "bg-slate-500/15",
    badgeText: "text-slate-300",
    label: "Component",
  },
};

export const SystemNode = memo(function SystemNode({
  data,
  selected,
}: NodeProps & { data: SystemNodeData }) {
  const nodeType = data?.nodeType || "service";
  const config = NODE_CONFIGS[nodeType] || NODE_CONFIGS.custom;
  const IconComponent = config.icon;

  return (
    <div
      className={cn(
        "relative group min-w-[190px] max-w-[280px] rounded-xl bg-surface/95 border backdrop-blur-md transition-all duration-200 shadow-xl select-none",
        selected
          ? "border-brand ring-2 ring-brand/30 shadow-brand/10 shadow-2xl scale-[1.02]"
          : "border-default hover:border-border-subtle hover:shadow-2xl"
      )}
    >
      {/* Target/Source Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className="!w-2.5 !h-2.5 !bg-border-subtle group-hover:!bg-brand !border-2 !border-surface transition-colors"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="source-top"
        className="!w-2.5 !h-2.5 !bg-border-subtle group-hover:!bg-brand !border-2 !border-surface transition-colors"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!w-2.5 !h-2.5 !bg-border-subtle group-hover:!bg-brand !border-2 !border-surface transition-colors"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="source-left"
        className="!w-2.5 !h-2.5 !bg-border-subtle group-hover:!bg-brand !border-2 !border-surface transition-colors"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="target-right"
        className="!w-2.5 !h-2.5 !bg-border-subtle group-hover:!bg-brand !border-2 !border-surface transition-colors"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="!w-2.5 !h-2.5 !bg-border-subtle group-hover:!bg-brand !border-2 !border-surface transition-colors"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target-bottom"
        className="!w-2.5 !h-2.5 !bg-border-subtle group-hover:!bg-brand !border-2 !border-surface transition-colors"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className="!w-2.5 !h-2.5 !bg-border-subtle group-hover:!bg-brand !border-2 !border-surface transition-colors"
      />

      {/* Card Header & Content */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Icon + Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                "h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 shadow-sm",
                config.colorClass
              )}
            >
              <IconComponent className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-semibold text-primary truncate tracking-tight">
                {data.label || "Unnamed Component"}
              </h4>
              <p className="text-[10px] text-muted truncate">
                {data.sublabel || config.label}
              </p>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center shrink-0">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                data.status === "error"
                  ? "bg-error animate-pulse"
                  : data.status === "idle"
                  ? "bg-slate-500"
                  : "bg-emerald-400"
              )}
              title={`Status: ${data.status || "active"}`}
            />
          </div>
        </div>

        {/* Optional Description */}
        {data.description && (
          <p className="text-[11px] text-secondary/90 leading-tight line-clamp-2 px-0.5">
            {data.description}
          </p>
        )}

        {/* Tag / Metadata Badge */}
        <div className="flex items-center justify-between pt-1 border-t border-default/60 text-[10px]">
          <span
            className={cn(
              "px-1.5 py-0.5 rounded font-mono font-medium tracking-wide uppercase text-[9px]",
              config.badgeBg,
              config.badgeText
            )}
          >
            {nodeType}
          </span>

          {data.metadata?.tech && (
            <span className="text-muted font-mono text-[9px] truncate max-w-[100px]">
              {String(data.metadata.tech)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
