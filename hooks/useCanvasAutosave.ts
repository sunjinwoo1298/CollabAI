"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import * as Y from "yjs";
import { CanvasNode, CanvasEdge } from "@/types/canvas";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseCanvasAutosaveOptions {
  projectId: string;
  doc: Y.Doc;
  nodesMap: Y.Map<any>;
  edgesMap: Y.Map<any>;
  isReady: boolean;
  disabled?: boolean;
  isAutosaveEnabled?: boolean;
  debounceMs?: number;
}

export interface UseCanvasAutosaveResult {
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  saveError: string | null;
  isDirty: boolean;
  saveNow: () => Promise<boolean>;
}

export function useCanvasAutosave({
  projectId,
  doc,
  nodesMap,
  edgesMap,
  isReady,
  disabled = false,
  isAutosaveEnabled = true,
  debounceMs = 1500,
}: UseCanvasAutosaveOptions): UseCanvasAutosaveResult {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const savePendingRef = useRef(false);
  const isMountedRef = useRef(true);
  const isDirtyRef = useRef(false);

  // Helper to serialize current canvas state from canonical Yjs maps
  const getCanvasPayload = useCallback(() => {
    const nodes = Array.from(nodesMap.values()) as CanvasNode[];
    const edges = Array.from(edgesMap.values()) as CanvasEdge[];
    return { nodes, edges };
  }, [nodesMap, edgesMap]);

  // Core save execution function (Works for both autosave and manual save)
  const executeSave = useCallback(async (): Promise<boolean> => {
    if (!projectId || disabled || !isReady) {
      return false;
    }

    if (isSavingRef.current) {
      // Mark that another save is required once current one finishes
      savePendingRef.current = true;
      return false;
    }

    isSavingRef.current = true;
    if (isMountedRef.current) {
      setSaveStatus("saving");
      setSaveError(null);
    }

    try {
      const payload = getCanvasPayload();

      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/canvas`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Save failed with status ${res.status}`);
      }

      if (isMountedRef.current) {
        setSaveStatus("saved");
        setLastSavedAt(new Date());
        setSaveError(null);
        setIsDirty(false);
      }
      isDirtyRef.current = false;
      return true;
    } catch (err: any) {
      console.error("[useCanvasAutosave] Error saving canvas:", err);
      if (isMountedRef.current) {
        setSaveStatus("error");
        setSaveError(err.message || "Failed to save canvas");
      }
      return false;
    } finally {
      isSavingRef.current = false;

      // If edits occurred while in-flight, immediately trigger queued save
      if (savePendingRef.current) {
        savePendingRef.current = false;
        // Schedule next execution on next tick
        setTimeout(() => {
          if (isMountedRef.current) {
            executeSave();
          }
        }, 50);
      }
    }
  }, [projectId, disabled, isReady, getCanvasPayload]);

  // Explicit manual save trigger
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    return executeSave();
  }, [executeSave]);

  // Schedule debounced autosave
  const scheduleAutosave = useCallback(() => {
    if (!isReady || disabled || !isAutosaveEnabled) return;

    isDirtyRef.current = true;
    if (isMountedRef.current) {
      setIsDirty(true);
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      executeSave();
    }, debounceMs);
  }, [isReady, disabled, isAutosaveEnabled, debounceMs, executeSave]);

  // Clear debounce timer if autosave is toggled off
  useEffect(() => {
    if (!isAutosaveEnabled && debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [isAutosaveEnabled]);

  // Observe Yjs document mutations
  useEffect(() => {
    isMountedRef.current = true;

    // Handler for doc updates
    const handleDocUpdate = (
      _update: Uint8Array,
      origin: string | object | null | undefined
    ) => {
      // 1. Keep autosave strictly disabled until initial restoration is finished or if autosave is disabled
      if (!isReady || disabled || !isAutosaveEnabled) return;

      // 2. Ignore blob-restore and redis-cache-restore transactions so initial restoration does not re-trigger save
      if (origin === "blob-restore" || origin === "redis-cache-restore") {
        return;
      }

      // 3. Trigger debounced autosave for meaningful changes
      scheduleAutosave();
    };

    doc.on("update", handleDocUpdate);

    return () => {
      isMountedRef.current = false;
      doc.off("update", handleDocUpdate);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // Best-effort flush on unmount if pending changes exist and autosave is enabled
      if (isDirtyRef.current && isReady && isAutosaveEnabled && projectId) {
        try {
          const payload = {
            nodes: Array.from(nodesMap.values()),
            edges: Array.from(edgesMap.values()),
          };
          fetch(`/api/projects/${encodeURIComponent(projectId)}/canvas`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true,
          }).catch((e) => {
            console.warn("[useCanvasAutosave] Best-effort unmount flush warning:", e);
          });
        } catch {
          // Ignore best-effort unmount flush errors
        }
      }
    };
  }, [doc, isReady, disabled, isAutosaveEnabled, projectId, nodesMap, edgesMap, scheduleAutosave]);

  // Best-effort beforeunload listener
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirtyRef.current && isReady && projectId) {
        try {
          const payload = {
            nodes: Array.from(nodesMap.values()),
            edges: Array.from(edgesMap.values()),
          };
          fetch(`/api/projects/${encodeURIComponent(projectId)}/canvas`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true,
          }).catch(() => {});
        } catch {}
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [projectId, isReady, nodesMap, edgesMap]);

  return {
    saveStatus,
    lastSavedAt,
    saveError,
    isDirty,
    saveNow,
  };
}
