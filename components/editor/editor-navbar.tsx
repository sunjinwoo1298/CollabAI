"use client";

import { PanelLeftOpen, PanelLeftClose, Share2, Sparkles, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { RemoteCollaborator } from "@/types/canvas";
import { ParticipantAvatarGroup } from "@/components/canvas/presence/participant-avatar-group";

interface EditorNavbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  projectName?: string;
  isAiSidebarOpen?: boolean;
  onToggleAiSidebar?: () => void;
  onOpenShare?: () => void;
  onOpenTemplates?: () => void;
  showWorkspaceActions?: boolean;
  collaborators?: RemoteCollaborator[];
}

export function EditorNavbar({
  isSidebarOpen,
  onToggleSidebar,
  projectName,
  isAiSidebarOpen = false,
  onToggleAiSidebar,
  onOpenShare,
  onOpenTemplates,
  showWorkspaceActions = false,
  collaborators = [],
}: EditorNavbarProps) {
  return (
    <header className="h-14 border-b border-default bg-base flex items-center justify-between px-4 shrink-0 z-50">
      {/* Left Section: Sidebar toggle */}
      <div className="flex items-center gap-2 min-w-0 w-1/4 sm:w-1/3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="text-muted hover:text-primary shrink-0"
          title={isSidebarOpen ? "Close projects sidebar" : "Open projects sidebar"}
          aria-label={isSidebarOpen ? "Close projects sidebar" : "Open projects sidebar"}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <PanelLeftOpen className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Center Section: Project name */}
      <div className="flex items-center justify-center flex-1 min-w-0 px-2">
        {projectName ? (
          <div className="flex items-center gap-1.5 max-w-xs sm:max-w-md md:max-w-lg truncate">
            <span
              className="text-sm font-semibold text-primary truncate"
              title={projectName}
            >
              {projectName}
            </span>
          </div>
        ) : null}
      </div>

      {/* Right Section: Workspace actions & UserButton */}
      <div className="flex items-center justify-end gap-2 w-auto sm:w-1/3 min-w-0">
        {showWorkspaceActions && (
          <>
            {onOpenTemplates && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenTemplates}
                className="h-8 gap-1.5 text-xs font-medium border-default text-primary hover:bg-subtle hover:text-primary cursor-pointer"
                title="Choose starter template"
              >
                <LayoutTemplate className="h-3.5 w-3.5 text-brand" />
                <span className="hidden sm:inline">Templates</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onOpenShare}
              className="h-8 gap-1.5 text-xs font-medium border-default text-primary hover:bg-subtle hover:text-primary"
              title="Share project"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share</span>
            </Button>

            {onToggleAiSidebar && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleAiSidebar}
                className={cn(
                  "h-8 w-8 text-muted hover:text-primary transition-colors",
                  isAiSidebarOpen && "bg-subtle text-ai hover:text-ai"
                )}
                title={isAiSidebarOpen ? "Close AI Assistant" : "Open AI Assistant"}
                aria-label={isAiSidebarOpen ? "Close AI Assistant" : "Open AI Assistant"}
              >
                <Sparkles className="h-4 w-4 text-ai" />
              </Button>
            )}
          </>
        )}

        {/* Active Collaborator Avatars (Only rendered when at least one remote collaborator is connected) */}
        {collaborators && collaborators.length > 0 && (
          <ParticipantAvatarGroup collaborators={collaborators} />
        )}

        {/* Divider between collaborators and Clerk UserButton (Only rendered when at least one collaborator exists) */}
        {collaborators && collaborators.length > 0 && (
          <div className="h-5 w-px bg-default mx-1 shrink-0" />
        )}

        <div className="shrink-0 flex items-center ml-1">
          <UserButton />
        </div>
      </div>
    </header>
  );
}

export default EditorNavbar;
