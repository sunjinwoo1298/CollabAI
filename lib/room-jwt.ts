import jwt from "jsonwebtoken";
import { WsAuthTokenPayload } from "@/types/collaboration";

const JWT_SECRET =
  process.env.ROOM_JWT_SECRET ||
  process.env.JWT_SECRET ||
  "collab-ai-dev-room-jwt-secret-key-change-in-production-32bytes-min";

const TOKEN_EXPIRY_SECONDS = 5 * 60; // 5 minutes short-lived token

/**
 * Signs a short-lived Room JWT containing project ID, room ID, user role, and user metadata.
 */
export function signRoomToken(
  payload: Omit<WsAuthTokenPayload, "iat" | "exp">,
  expiresInSeconds = TOKEN_EXPIRY_SECONDS
): string {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: expiresInSeconds,
    issuer: "collaborator-ai-auth",
    audience: "collaborator-ai-ws",
  });
}

/**
 * Verifies and decodes a Room JWT. Returns the payload or null if invalid/expired.
 */
export function verifyRoomToken(token: string): WsAuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "collaborator-ai-auth",
      audience: "collaborator-ai-ws",
    }) as WsAuthTokenPayload;

    return decoded;
  } catch (err) {
    return null;
  }
}
