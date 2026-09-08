"use client";

import React, { memo } from "react";
import { ViewportPortal } from "@xyflow/react";
import { Sparkles } from "lucide-react";
import { RemoteCollaborator } from "@/types/canvas";

interface CollaboratorCursorProps {
  collaborator: RemoteCollaborator;
}

export const CollaboratorCursor = memo(function CollaboratorCursor({
  collaborator,
}: CollaboratorCursorProps) {
  const { user, cursor, isThinking } = collaborator;

  if (!cursor) return null;

  const userColor = user?.color || "#10B981";
  const userName = user?.name || "Collaborator";

  return (
    <div
      className="pointer-events-none absolute z-50 transition-transform duration-75 ease-out will-change-transform select-none"
      style={{
        transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)`,
        left: 0,
        top: 0,
      }}
    >
      {/* SVG Mouse Pointer Tip at (0,0) */}
      <svg
        className="h-5 w-5 drop-shadow-md"
        viewBox="0 0 18 18"
        fill="none"
      >
        <path
          d="M1 1L7.5 16.5L10 10L16.5 7.5L1 1Z"
          fill={userColor}
          stroke="#0B0F19"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      {/* Collaborator Badge Tag */}
      <div
        className="ml-3 -mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium text-white shadow-lg backdrop-blur-md whitespace-nowrap"
        style={{
          backgroundColor: userColor,
        }}
      >
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={userName}
            className="h-3.5 w-3.5 rounded-full border border-white/40 object-cover shrink-0"
          />
        ) : null}

        <span className="font-semibold tracking-tight">{userName}</span>

        {isThinking && (
          <span className="flex items-center gap-1 bg-black/30 px-1.5 py-0.5 rounded-full text-[9px]">
            <Sparkles className="h-2.5 w-2.5 animate-spin text-amber-300" />
            <span className="animate-pulse">Thinking...</span>
          </span>
        )}
      </div>
    </div>
  );
});

interface CollaboratorCursorsProps {
  collaborators: RemoteCollaborator[];
}

export const CollaboratorCursors = memo(function CollaboratorCursors({
  collaborators,
}: CollaboratorCursorsProps) {
  return (
    <ViewportPortal>
      <div className="pointer-events-none absolute inset-0 z-50">
        {collaborators.map((collab) => (
          <CollaboratorCursor key={collab.clientId} collaborator={collab} />
        ))}
      </div>
    </ViewportPortal>
  );
});
