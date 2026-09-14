"use client";

import { useState, useRef, useCallback } from "react";
import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { AiSidebar } from "@/components/editor/ai-sidebar";
import { useProjectActions } from "@/hooks/useProjectActions";
import { CreateProjectDialog } from "@/components/editor/dialogs/create-project-dialog";
import { RenameProjectDialog } from "@/components/editor/dialogs/rename-project-dialog";
import { DeleteProjectDialog } from "@/components/editor/dialogs/delete-project-dialog";
import { ShareDialog } from "@/components/editor/dialogs/share-dialog";
import { CollaborativeCanvas } from "@/components/canvas/collaborative-canvas";
import { Project } from "@/types/project";
import { RemoteCollaborator } from "@/types/canvas";
import { SaveStatus } from "@/hooks/useCanvasAutosave";

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
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<RemoteCollaborator[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveNowRef = useRef<(() => Promise<boolean>) | null>(null);

  const handleSaveStatusChange = useCallback(
    (status: SaveStatus, saveNow: () => Promise<boolean>) => {
      setSaveStatus(status);
      saveNowRef.current = saveNow;
    },
    []
  );

  const handleManualSave = useCallback(() => {
    if (saveNowRef.current) {
      saveNowRef.current();
    }
  }, []);

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
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        showWorkspaceActions={true}
        collaborators={collaborators}
        saveStatus={saveStatus}
        onSaveNow={handleManualSave}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 relative w-full h-full overflow-hidden">
        {/* Full-bleed Canvas Area (Spans edge-to-edge behind sidebars) */}
        <main className="absolute inset-0 w-full h-full bg-base overflow-hidden">
          <CollaborativeCanvas
            projectId={project.id}
            isOwner={project.isOwner}
            isTemplatesOpen={isTemplatesOpen}
            onOpenTemplates={() => setIsTemplatesOpen(true)}
            onCloseTemplates={() => setIsTemplatesOpen(false)}
            onCollaboratorsChange={setCollaborators}
            onSaveStatusChange={handleSaveStatusChange}
          />
        </main>

        {/* Floating Left Project Sidebar */}
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

        {/* Floating Right AI Workspace Sidebar */}
        <AiSidebar
          isOpen={isAiSidebarOpen}
          onClose={() => setIsAiSidebarOpen(false)}
        />
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
