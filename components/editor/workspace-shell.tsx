"use client";

import { useState } from "react";
import { Sparkles, X, Layers, Bot } from "lucide-react";
import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { Button } from "@/components/ui/button";
import { useProjectActions } from "@/hooks/useProjectActions";
import { CreateProjectDialog } from "@/components/editor/dialogs/create-project-dialog";
import { RenameProjectDialog } from "@/components/editor/dialogs/rename-project-dialog";
import { DeleteProjectDialog } from "@/components/editor/dialogs/delete-project-dialog";
import { ShareDialog } from "@/components/editor/dialogs/share-dialog";
import { Project } from "@/types/project";

interface WorkspaceShellProps {
  project: {
    id: string;
    name: string;
    description?: string | null;
    ownerId: string;
    isOwner: boolean;
  };
  ownedProjects: Project[];
  sharedProjects: Project[];
}

export function WorkspaceShell({
  project,
  ownedProjects,
  sharedProjects,
}: WorkspaceShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const {
    isCreateOpen,
    isRenameOpen,
    isDeleteOpen,
    targetProject,
    isLoading,
    projectName,
    setProjectName,
    slugPreview,
    renameName,
    setRenameName,
    openCreate,
    closeCreate,
    openRename,
    closeRename,
    openDelete,
    closeDelete,
    handleCreate,
    handleRename,
    handleDelete,
  } = useProjectActions();

  return (
    <div className="h-screen w-screen bg-base text-primary flex flex-col overflow-hidden">
      {/* Top Navbar */}
      <EditorNavbar
        projectName={project.name}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        isAiSidebarOpen={isAiSidebarOpen}
        onToggleAiSidebar={() => setIsAiSidebarOpen((prev) => !prev)}
        onOpenShare={() => setIsShareOpen(true)}
        showWorkspaceActions={true}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Left Project Sidebar */}
        <ProjectSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          ownedProjects={ownedProjects}
          sharedProjects={sharedProjects}
          currentRoomId={project.id}
          onOpenCreate={openCreate}
          onOpenRename={openRename}
          onOpenDelete={openDelete}
        />

        {/* Center Canvas Area (Fills remaining space) */}
        <main className="flex-1 h-full relative flex items-center justify-center bg-base overflow-hidden select-none">
          {/* Subtle Canvas Dot Grid Background */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(var(--border-default) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Central Canvas Placeholder Message */}
          <div className="relative z-10 max-w-sm w-full mx-4 p-8 rounded-2xl bg-surface/80 border border-default shadow-2xl backdrop-blur-sm text-center space-y-4">
            <div className="h-12 w-12 rounded-xl bg-subtle border border-default flex items-center justify-center mx-auto text-muted">
              <Layers className="h-6 w-6 text-brand" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-primary tracking-tight">
                {project.name}
              </h2>
              <p className="text-xs text-muted">
                Visual architecture canvas will be loaded here.
              </p>
            </div>

            <div className="pt-1">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-mono bg-subtle border border-default text-muted">
                Room: {project.id}
              </span>
            </div>
          </div>
        </main>

        {/* Right AI Sidebar Placeholder */}
        {isAiSidebarOpen && (
          <aside className="w-80 lg:w-96 border-l border-default bg-elevated shrink-0 flex flex-col h-full z-20 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="h-14 border-b border-default px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-ai" />
                <h3 className="text-sm font-semibold text-primary">AI Assistant</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsAiSidebarOpen(false)}
                className="h-7 w-7 text-muted hover:text-primary"
                title="Close AI Assistant"
                aria-label="Close AI Assistant"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4 overflow-y-auto">
              <div className="h-14 w-14 rounded-2xl bg-ai/10 border border-ai/20 flex items-center justify-center text-ai">
                <Bot className="h-7 w-7" />
              </div>
              <div className="space-y-2 max-w-xs">
                <h4 className="text-sm font-semibold text-primary">
                  AI Architecture Assistant
                </h4>
                <p className="text-xs text-muted leading-relaxed">
                  Interactive AI design chat, system diagram generation, and architecture synthesis will appear here.
                </p>
              </div>
              <div className="pt-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wide uppercase bg-ai/10 text-ai-muted border border-ai/30">
                  Coming Soon
                </span>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Share Dialog */}
      <ShareDialog
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        projectId={project.id}
        projectName={project.name}
        isOwner={project.isOwner}
      />

      {/* Project Management Dialogs */}
      <CreateProjectDialog
        isOpen={isCreateOpen}
        onClose={closeCreate}
        name={projectName}
        onNameChange={setProjectName}
        slugPreview={slugPreview}
        onSubmit={handleCreate}
        isLoading={isLoading}
      />

      <RenameProjectDialog
        isOpen={isRenameOpen}
        onClose={closeRename}
        currentProjectName={targetProject?.name || ""}
        name={renameName}
        onNameChange={setRenameName}
        onSubmit={handleRename}
        isLoading={isLoading}
      />

      <DeleteProjectDialog
        isOpen={isDeleteOpen}
        onClose={closeDelete}
        projectName={targetProject?.name || ""}
        onConfirm={handleDelete}
        isLoading={isLoading}
      />
    </div>
  );
}

export default WorkspaceShell;
