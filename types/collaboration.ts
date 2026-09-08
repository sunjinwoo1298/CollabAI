export interface UserPresence {
  cursor: {
    x: number;
    y: number;
  } | null;
  isThinking?: boolean;
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
}
