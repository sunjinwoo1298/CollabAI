"use client";

import React, { memo } from "react";
import { RemoteCollaborator } from "@/types/canvas";
import { cn } from "@/lib/utils";

interface ParticipantAvatarGroupProps {
  collaborators: RemoteCollaborator[];
  className?: string;
  maxAvatars?: number;
}

/**
 * Extracts uppercase initials from user's full or single name.
 * e.g., "Jane Doe" -> "JD", "Alex" -> "A"
 */
export function getInitials(name?: string): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const ParticipantAvatarGroup = memo(function ParticipantAvatarGroup({
  collaborators,
  className,
  maxAvatars = 5,
}: ParticipantAvatarGroupProps) {
  if (!collaborators || collaborators.length === 0) {
    return null;
  }

  const visibleCollaborators = collaborators.slice(0, maxAvatars);
  const overflowCount = Math.max(0, collaborators.length - maxAvatars);

  return (
    <div
      className={cn("flex items-center -space-x-2 shrink-0 select-none", className)}
      aria-label="Active collaborators"
    >
      {visibleCollaborators.map((collab) => {
        const { user, clientId } = collab;
        const userName = user?.name || "Collaborator";
        const userColor = user?.color || "#10B981";
        const initials = getInitials(userName);

        return (
          <div
            key={`${user?.userId || clientId}`}
            className="relative inline-flex items-center justify-center h-7 w-7 rounded-full ring-2 ring-base overflow-hidden shrink-0 transition-transform duration-150 group"
            title={userName}
          >
            {/* Fallback initials display rendered first */}
            <div
              className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white uppercase tracking-wider"
              style={{
                backgroundColor: userColor,
              }}
            >
              {initials}
            </div>

            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={userName}
                className="relative z-10 h-full w-full object-cover rounded-full"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : null}
          </div>
        );
      })}

      {/* Overflow Indicator (+N) */}
      {overflowCount > 0 && (
        <div
          className="relative inline-flex items-center justify-center h-7 w-7 rounded-full bg-subtle border border-default text-[10px] font-semibold text-muted ring-2 ring-base shrink-0 select-none"
          title={`${overflowCount} more active participant${overflowCount > 1 ? "s" : ""}`}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
});

export default ParticipantAvatarGroup;
