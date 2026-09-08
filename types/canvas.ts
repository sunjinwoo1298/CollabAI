import { Node, Edge } from "@xyflow/react";
import { UserMeta } from "./collaboration";

export type CanvasNodeType =
  | "service"
  | "database"
  | "cache"
  | "queue"
  | "gateway"
  | "storage"
  | "client"
  | "custom";

export interface SystemNodeData {
  label: string;
  sublabel?: string;
  nodeType: CanvasNodeType;
  icon?: string;
  description?: string;
  status?: "active" | "idle" | "error";
  metadata?: Record<string, string | number | boolean | null>;
  [key: string]: unknown;
}

export type CanvasNode = Node<SystemNodeData, "system">;
export type CanvasEdge = Edge;

export interface RemoteCollaborator {
  clientId: number;
  user: UserMeta;
  cursor: {
    x: number;
    y: number;
  } | null;
  isThinking?: boolean;
}
