import jwt from "jsonwebtoken";
import { WsAuthTokenPayload } from "../../types/collaboration";

const JWT_SECRET =
  process.env.ROOM_JWT_SECRET ||
  process.env.JWT_SECRET ||
  "collab-ai-dev-room-jwt-secret-key-change-in-production-32bytes-min";

export interface AuthValidationResult {
  valid: boolean;
  error?: string;
  statusCode?: number;
  payload?: WsAuthTokenPayload;
}

/**
 * Validates a Room JWT token against a requested room ID.
 * Standalone WebSocket server does NOT query PostgreSQL (Invariant 2).
 * Strictly ensures project.id === roomId (Invariant 1).
 */
export function validateWsToken(
  token: string | undefined | null,
  requestedRoomId: string
): AuthValidationResult {
  if (!token) {
    return {
      valid: false,
      error: "Missing authentication token",
      statusCode: 4401,
    };
  }

  if (!requestedRoomId || typeof requestedRoomId !== "string") {
    return {
      valid: false,
      error: "Missing or invalid roomId",
      statusCode: 4400,
    };
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "collaborator-ai-auth",
      audience: "collaborator-ai-ws",
    }) as WsAuthTokenPayload;

    // Verify token payload structure
    if (!payload || !payload.sub || !payload.projectId || !payload.roomId) {
      return {
        valid: false,
        error: "Malformed token payload",
        statusCode: 4401,
      };
    }

    // Strictly enforce Invariant 1: project.id === roomId === requestedRoomId
    if (payload.projectId !== requestedRoomId || payload.roomId !== requestedRoomId) {
      return {
        valid: false,
        error: "Token roomId mismatch: unauthorized for requested room",
        statusCode: 4403,
      };
    }

    return {
      valid: true,
      payload,
    };
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return {
        valid: false,
        error: "Token has expired",
        statusCode: 4401,
      };
    }

    return {
      valid: false,
      error: "Invalid token signature or payload",
      statusCode: 4401,
    };
  }
}
