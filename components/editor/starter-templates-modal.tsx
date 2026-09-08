"use client";

import React, { useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CANVAS_TEMPLATES, CanvasTemplate } from "@/components/editor/starter-templates";
import { CanvasNodeType, CanvasNode } from "@/types/canvas";
import {
  Sparkles,
  ArrowRight,
  Layers,
  Network,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StarterTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (template: CanvasTemplate) => void;
}

// Color and styling map for preview SVG nodes
const PREVIEW_NODE_THEMES: Record<
  CanvasNodeType,
  {
    fill: string;
    stroke: string;
    text: string;
    badgeBg: string;
    badgeText: string;
    dotColor: string;
  }
> = {
  service: {
    fill: "#064E3B",
    stroke: "#10B981",
    text: "#ECFDF5",
    badgeBg: "#047857",
    badgeText: "#A7F3D0",
    dotColor: "#34D399",
  },
  database: {
    fill: "#1E3A8A",
    stroke: "#3B82F6",
    text: "#EFF6FF",
    badgeBg: "#1D4ED8",
    badgeText: "#BFDBFE",
    dotColor: "#60A5FA",
  },
  cache: {
    fill: "#78350F",
    stroke: "#F59E0B",
    text: "#FFFBEB",
    badgeBg: "#B45309",
    badgeText: "#FDE68A",
    dotColor: "#FBBF24",
  },
  queue: {
    fill: "#581C87",
    stroke: "#A855F7",
    text: "#FAF5FF",
    badgeBg: "#7E22CE",
    badgeText: "#E9D5FF",
    dotColor: "#C084FC",
  },
  gateway: {
    fill: "#881337",
    stroke: "#F43F5E",
    text: "#FFF1F2",
    badgeBg: "#BE123C",
    badgeText: "#FECDD3",
    dotColor: "#FB7185",
  },
  storage: {
    fill: "#164E63",
    stroke: "#06B6D4",
    text: "#ECFEFF",
    badgeBg: "#0E7490",
    badgeText: "#A5F3FC",
    dotColor: "#22D3EE",
  },
  client: {
    fill: "#312E81",
    stroke: "#6366F1",
    text: "#EEF2FF",
    badgeBg: "#4338CA",
    badgeText: "#C7D2FE",
    dotColor: "#818CF8",
  },
  custom: {
    fill: "#1E293B",
    stroke: "#64748B",
    text: "#F8FAFC",
    badgeBg: "#334155",
    badgeText: "#CBD5E1",
    dotColor: "#94A3B8",
  },
};

// Node dimensions for the lightweight SVG preview calculation
const PREVIEW_NODE_W = 164;
const PREVIEW_NODE_H = 64;

function TemplatePreview({ template }: { template: CanvasTemplate }) {
  const { viewBox, nodeMap } = useMemo(() => {
    const nodes = template.nodes;
    if (!nodes || nodes.length === 0) {
      return {
        viewBox: "0 0 400 200",
        nodeMap: new Map<string, CanvasNode>(),
      };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const map = new Map<string, CanvasNode>();

    for (const node of nodes) {
      map.set(node.id, node);
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x + PREVIEW_NODE_W);
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y + PREVIEW_NODE_H);
    }

    const paddingX = 48;
    const paddingY = 40;
    const width = Math.max(maxX - minX + paddingX * 2, 260);
    const height = Math.max(maxY - minY + paddingY * 2, 160);

    return {
      viewBox: `${minX - paddingX} ${minY - paddingY} ${width} ${height}`,
      nodeMap: map,
    };
  }, [template]);

  return (
    <div className="w-full h-52 sm:h-56 bg-surface/90 rounded-xl border border-default/70 overflow-hidden relative group/preview flex items-center justify-center p-3 select-none">
      {/* Background Subtle Grid Pattern */}
      <svg
        className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id={`grid-${template.id}`}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1.2" fill="#64748B" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid-${template.id})`} />
      </svg>

      <svg
        viewBox={viewBox}
        className="w-full h-full relative z-10 transition-transform duration-300 group-hover/preview:scale-[1.03]"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={`edge-grad-${template.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#475569" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#64748B" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#475569" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* 1. Edges */}
        {template.edges.map((edge) => {
          const sourceNode = nodeMap.get(edge.source);
          const targetNode = nodeMap.get(edge.target);
          if (!sourceNode || !targetNode) return null;

          const sx =
            sourceNode.position.x < targetNode.position.x
              ? sourceNode.position.x + PREVIEW_NODE_W
              : sourceNode.position.x;
          const sy = sourceNode.position.y + PREVIEW_NODE_H / 2;

          const tx =
            targetNode.position.x > sourceNode.position.x
              ? targetNode.position.x
              : targetNode.position.x + PREVIEW_NODE_W;
          const ty = targetNode.position.y + PREVIEW_NODE_H / 2;

          const dx = Math.abs(tx - sx) * 0.5;
          const pathData = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;

          return (
            <path
              key={edge.id}
              d={pathData}
              fill="none"
              stroke={`url(#edge-grad-${template.id})`}
              strokeWidth="2.5"
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
          );
        })}

        {/* 2. Nodes */}
        {template.nodes.map((node) => {
          const nodeType = node.data?.nodeType || "custom";
          const theme = PREVIEW_NODE_THEMES[nodeType] || PREVIEW_NODE_THEMES.custom;
          const label = node.data?.label || "Node";
          const sublabel = node.data?.sublabel || nodeType;

          return (
            <g
              key={node.id}
              transform={`translate(${node.position.x}, ${node.position.y})`}
            >
              {/* Outer Card Rectangle */}
              <rect
                width={PREVIEW_NODE_W}
                height={PREVIEW_NODE_H}
                rx="8"
                ry="8"
                fill="#0F172A"
                fillOpacity="0.95"
                stroke={theme.stroke}
                strokeWidth="1.5"
                strokeOpacity="0.75"
              />

              {/* Archetype color bar indicator */}
              <rect
                x="0"
                y="0"
                width="4"
                height={PREVIEW_NODE_H}
                rx="2"
                fill={theme.stroke}
              />

              {/* Status light dot */}
              <circle
                cx={PREVIEW_NODE_W - 12}
                cy="14"
                r="3"
                fill={theme.dotColor}
                opacity="0.9"
              />

              {/* Main Label */}
              <text
                x="14"
                y="22"
                fill={theme.text}
                fontSize="11"
                fontWeight="600"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {label.length > 17 ? `${label.substring(0, 16)}...` : label}
              </text>

              {/* Sublabel */}
              <text
                x="14"
                y="36"
                fill="#94A3B8"
                fontSize="9"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {sublabel.length > 22 ? `${sublabel.substring(0, 20)}...` : sublabel}
              </text>

              {/* Type Badge Tag */}
              <rect
                x="14"
                y="43"
                width={nodeType.length * 6 + 12}
                height="13"
                rx="3"
                fill={theme.badgeBg}
                fillOpacity="0.6"
              />
              <text
                x="20"
                y="52"
                fill={theme.badgeText}
                fontSize="7.5"
                fontWeight="700"
                letterSpacing="0.5"
                fontFamily="monospace"
              >
                {nodeType.toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function StarterTemplatesModal({
  isOpen,
  onClose,
  onImport,
}: StarterTemplatesModalProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleSelectTemplate = (template: CanvasTemplate) => {
    onImport(template);
    onClose();
  };

  const handleScroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 450;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-surface border-default text-primary !max-w-[95vw] sm:!max-w-[92vw] md:!max-w-[88vw] lg:!max-w-[1200px] w-full max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-default shrink-0 bg-surface/50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-primary text-base sm:text-lg font-semibold tracking-tight flex items-center gap-2">
                  Starter Architecture Templates
                </DialogTitle>
                <DialogDescription className="text-muted text-xs sm:text-sm mt-0.5">
                  Browse and import pre-built architectures to kickstart your collaborative canvas.
                </DialogDescription>
              </div>
            </div>

            {/* Horizontal Scroll Navigation Controls */}
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleScroll("left")}
                className="h-8 w-8 rounded-lg border-default bg-surface/80 hover:bg-subtle text-muted hover:text-primary cursor-pointer"
                title="Scroll Left"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleScroll("right")}
                className="h-8 w-8 rounded-lg border-default bg-surface/80 hover:bg-subtle text-muted hover:text-primary cursor-pointer"
                title="Scroll Right"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Horizontal Scrollable Templates Carousel */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden p-6 flex flex-row items-stretch gap-5 scroll-smooth snap-x snap-mandatory"
          style={{ scrollbarWidth: "thin" }}
        >
          {CANVAS_TEMPLATES.map((template) => (
            <div
              key={template.id}
              className="group relative w-[320px] sm:w-[380px] md:w-[420px] shrink-0 snap-start rounded-2xl border border-default bg-base/70 hover:bg-surface/95 hover:border-brand/40 p-5 transition-all duration-200 flex flex-col justify-between space-y-4 shadow-xl hover:shadow-2xl hover:shadow-brand/5"
            >
              {/* Header & Meta */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-brand px-2.5 py-0.5 rounded-full bg-brand/10 border border-brand/20">
                    {template.category || "Architecture"}
                  </span>

                  <div className="flex items-center gap-2 text-[11px] text-muted font-mono">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {template.nodes.length} nodes
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Network className="h-3 w-3" />
                      {template.edges.length} edges
                    </span>
                  </div>
                </div>

                <h3 className="text-base font-semibold text-primary group-hover:text-brand transition-colors tracking-tight">
                  {template.name}
                </h3>

                <p className="text-xs text-muted leading-relaxed line-clamp-2 h-8">
                  {template.description}
                </p>
              </div>

              {/* SVG Visual Diagram Preview */}
              <TemplatePreview template={template} />

              {/* Action Button */}
              <div className="pt-2 flex items-center justify-between gap-3 border-t border-default/50">
                <div className="text-[11px] text-muted flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Ready to import</span>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleSelectTemplate(template)}
                  className="h-9 px-4 gap-1.5 text-xs font-semibold bg-brand hover:bg-brand/90 text-primary-foreground shadow-md shadow-brand/20 rounded-xl cursor-pointer"
                >
                  <span>Import Template</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-default bg-surface/60 flex items-center justify-between text-xs text-muted shrink-0">
          <span className="text-[11px] text-secondary">
            Note: Importing replaces your current canvas state atomically.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs text-muted hover:text-primary"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default StarterTemplatesModal;
