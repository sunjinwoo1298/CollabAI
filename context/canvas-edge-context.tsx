"use client";

import { createContext, useContext, ReactNode } from "react";

export interface CanvasEdgeContextType {
  updateEdgeLabel: (edgeId: string, label: string) => void;
  editingEdgeId?: string | null;
  setEditingEdgeId?: (id: string | null) => void;
}

export const CanvasEdgeContext = createContext<CanvasEdgeContextType | null>(null);

export function useCanvasEdgeContext(): CanvasEdgeContextType {
  const ctx = useContext(CanvasEdgeContext);
  if (!ctx) {
    // Graceful fallback if rendered outside provider (e.g. preview mode or tests)
    return {
      updateEdgeLabel: () => {},
      editingEdgeId: null,
      setEditingEdgeId: () => {},
    };
  }
  return ctx;
}

export interface CanvasEdgeProviderProps {
  children: ReactNode;
  value: CanvasEdgeContextType;
}

export function CanvasEdgeProvider({ children, value }: CanvasEdgeProviderProps) {
  return (
    <CanvasEdgeContext.Provider value={value}>
      {children}
    </CanvasEdgeContext.Provider>
  );
}
