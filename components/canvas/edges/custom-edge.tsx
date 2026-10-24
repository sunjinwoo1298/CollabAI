"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { useCanvasEdgeContext } from "@/context/canvas-edge-context";
import { cn } from "@/lib/utils";

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  selected,
}: EdgeProps) {
  const { updateEdgeLabel, editingEdgeId, setEditingEdgeId } = useCanvasEdgeContext();

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  const [isHovered, setIsHovered] = useState(false);
  const isEditing = editingEdgeId === id;
  const [draftLabel, setDraftLabel] = useState(typeof label === "string" ? label : "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft label when external/Yjs label changes and not currently editing
  useEffect(() => {
    if (!isEditing) {
      setDraftLabel(typeof label === "string" ? label : "");
    }
  }, [label, isEditing]);

  // Focus and select text when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isEditing]);

  const handleStartEdit = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setDraftLabel(typeof label === "string" ? label : "");
    setEditingEdgeId?.(id);
  }, [id, label, setEditingEdgeId]);

  const handleCommit = useCallback(() => {
    setEditingEdgeId?.(null);
    const trimmed = draftLabel.trim();
    if (trimmed !== (typeof label === "string" ? label : "")) {
      updateEdgeLabel(id, trimmed);
    }
  }, [id, draftLabel, label, updateEdgeLabel, setEditingEdgeId]);

  const handleCancel = useCallback(() => {
    setDraftLabel(typeof label === "string" ? label : "");
    setEditingEdgeId?.(null);
  }, [label, setEditingEdgeId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        handleCommit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleCommit, handleCancel]
  );

  // Compute active stroke style
  const strokeColor = selected
    ? "#818CF8" // Active Brand Indigo
    : isHovered
    ? "#94A3B8" // Hovered slate
    : (style?.stroke as string) || "#64748B";

  const strokeWidth = selected ? 2.5 : isHovered ? 2.5 : Number(style?.strokeWidth) || 2;

  const displayLabel = typeof label === "string" ? label.trim() : "";

  return (
    <>
      {/* Invisible wider interaction stroke for effortless hover & double-click */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        className="cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDoubleClick={handleStartEdit}
      />

      {/* Main Visible Edge Path */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          transition: "stroke 0.15s ease, stroke-width 0.15s ease",
        }}
      />

      {/* Interactive Midpoint Label Badge (Rendered in React Flow's Edge Label Layer) */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isEditing ? (
            /* Inline Input Mode */
            <div
              className="flex items-center gap-1 bg-surface border-2 border-brand ring-4 ring-brand/20 rounded-lg shadow-2xl p-1 z-50 animate-in zoom-in-95 duration-150"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input
                ref={inputRef}
                type="text"
                value={draftLabel}
                placeholder="e.g. HTTPS, REST..."
                onChange={(e) => setDraftLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleCommit}
                className="bg-transparent text-primary text-xs font-mono font-medium px-1.5 py-0.5 outline-none min-w-[70px] max-w-[160px] text-center"
              />
            </div>
          ) : displayLabel ? (
            /* Saved Label Badge */
            <div
              onDoubleClick={handleStartEdit}
              title="Double-click to edit label"
              className={cn(
                "group relative flex items-center justify-center px-2.5 py-0.5 rounded-md font-mono text-[11px] font-semibold shadow-md backdrop-blur-md transition-all cursor-pointer select-none border",
                selected
                  ? "bg-brand/20 border-brand text-brand ring-2 ring-brand/30"
                  : isHovered
                  ? "bg-surface border-brand/60 text-primary shadow-lg scale-105"
                  : "bg-surface/90 border-default text-primary"
              )}
            >
              <span>{displayLabel}</span>
            </div>
          ) : (isHovered || selected) ? (
            /* Faint Discovery Hint when edge has no label */
            <button
              type="button"
              onClick={handleStartEdit}
              onDoubleClick={handleStartEdit}
              title="Add text label to this connection"
              className="px-2 py-0.5 rounded bg-surface/80 border border-dashed border-default hover:border-brand/70 text-[10px] font-mono text-muted hover:text-primary transition-all shadow backdrop-blur-sm cursor-pointer select-none"
            >
              + Label
            </button>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const customEdgeTypes = {
  custom: CustomEdge,
  smoothstep: CustomEdge,
  default: CustomEdge,
};
