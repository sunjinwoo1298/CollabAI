"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { Button } from "@/components/ui/button";
import { useProjectDialogs } from "@/hooks/use-project-dialogs";
import { CreateProjectDialog } from "@/components/editor/dialogs/create-project-dialog";
import { RenameProjectDialog } from "@/components/editor/dialogs/rename-project-dialog";
import { DeleteProjectDialog } from "@/components/editor/dialogs/delete-project-dialog";

export default function EditorHomePage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const {
    ownedProjects,
    sharedProjects,
    isCreateOpen,
    isRenameOpen,
    isDeleteOpen,
    targetProject,
    isLoading,
    createName,
    setCreateName,
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
  } = useProjectDialogs();

  return (
    <div className="min-h-screen bg-base text-primary flex flex-col overflow-hidden">
      <EditorNavbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div className="flex-1 relative flex overflow-hidden">
        <ProjectSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          ownedProjects={ownedProjects}
          sharedProjects={sharedProjects}
          onOpenCreate={openCreate}
          onOpenRename={openRename}
          onOpenDelete={openDelete}
        />

        <main className="flex-1 overflow-auto flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <h1 className="text-xl sm:text-2xl font-semibold text-primary tracking-tight">
              Create a project or open an existing one
            </h1>
            <p className="text-sm text-muted">
              Start a new architecture workspace, or choose a project from the sidebar.
            </p>
            <div className="pt-2">
              <Button
                variant="default"
                onClick={openCreate}
                className="gap-2 px-5 py-2 font-medium"
              >
                <Plus className="h-4 w-4" /> New Project
              </Button>
            </div>
          </div>
        </main>
      </div>

      {/* Project Dialogs */}
      <CreateProjectDialog
        isOpen={isCreateOpen}
        onClose={closeCreate}
        name={createName}
        onNameChange={setCreateName}
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
