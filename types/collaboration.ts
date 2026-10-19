export interface UserPresence {
  cursor: {
    x: number;
    y: number;
  } | null;
  isThinking?: boolean;
  thinking?: boolean;
  statusMessage?: string;
  text?: string;
  runId?: string;
  projectId?: string;
  status?: string;
  timestamp?: number;
}

export interface UserMeta {
  userId: string;
  name: string;
  avatar: string;
  color: string;
}

export interface AwarenessState {
  user: UserMeta;
  presence: UserPresence;
}

export type CollaborationRole = "owner" | "collaborator";

export interface WsAuthTokenPayload {
  sub: string;
  projectId: string;
  roomId: string;
  role: CollaborationRole;
  userMeta: UserMeta;
  iat?: number;
  exp?: number;
}

export interface WsAuthResponse {
  token: string;
  wsUrl: string;
  user?: UserMeta;
}

// WebSocket message constants
export const WS_MESSAGE_SYNC = 0;
export const WS_MESSAGE_AWARENESS = 1;
export const WS_MESSAGE_AUTH = 2;
export const WS_MESSAGE_QUERY_AWARENESS = 3;
export const WS_MESSAGE_CHAT = 4;

import { z } from "zod";

/**
 * Shared Zod schema for validated room chat messages.
 */
export const RoomChatMessageSchema = z.object({
  id: z.string().min(1, "Message ID is required"),
  projectId: z.string().min(1, "Project ID is required"),
  senderId: z.string().min(1, "Sender ID is required"),
  sender: z.string().min(1, "Sender name is required"),
  role: z.literal("user"),
  content: z
    .string()
    .trim()
    .min(1, "Message content cannot be empty")
    .max(4000, "Message content exceeds maximum length of 4000 characters"),
  timestamp: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Timestamp must be a valid ISO 8601 string",
  }),
});

export type RoomChatMessage = z.infer<typeof RoomChatMessageSchema>;

/**
 * Zod schema for client message input payload.
 */
export const SendChatMessageInputSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message content cannot be empty")
    .max(4000, "Message content exceeds maximum length of 4000 characters"),
  id: z.string().optional(),
  runId: z.string().optional(),
});

export type SendChatMessageInput = z.infer<typeof SendChatMessageInputSchema>;

/**
 * Zod schema for realtime room chat events.
 */
export const RoomChatEventSchema = z.object({
  type: z.literal("chat_message"),
  message: RoomChatMessageSchema,
});

export type RoomChatEvent = z.infer<typeof RoomChatEventSchema>;

/**
 * Helper to validate incoming or outgoing room chat message against strict schema.
 */
export function validateRoomChatMessage(data: unknown): {
  valid: boolean;
  message?: RoomChatMessage;
  error?: string;
} {
  const result = RoomChatMessageSchema.safeParse(data);
  if (!result.success) {
    return {
      valid: false,
      error: result.error.issues.map((i) => i.message).join(", "),
    };
  }
  return { valid: true, message: result.data };
}

/**
 * Helper to validate client chat input.
 */
export function validateSendChatInput(data: unknown): {
  valid: boolean;
  input?: SendChatMessageInput;
  error?: string;
} {
  const result = SendChatMessageInputSchema.safeParse(data);
  if (!result.success) {
    return {
      valid: false,
      error: result.error.issues.map((i) => i.message).join(", "),
    };
  }
  return { valid: true, input: result.data };
}

