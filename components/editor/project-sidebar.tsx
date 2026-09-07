import Link from "next/link";
import { Plus, X, Pencil, Trash2, Folder, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Project } from "@/types/project";

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  ownedProjects: Project[];
  sharedProjects: Project[];
  onOpenCreate: () => void;
  onOpenRename: (project: Project) => void;
  onOpenDelete: (project: Project) => void;
}

export function ProjectSidebar({
  isOpen,
  onClose,
  ownedProjects,
  sharedProjects,
  onOpenCreate,
  onOpenRename,
  onOpenDelete,
}: ProjectSidebarProps) {
  return (
    <>
      {/* Mobile backdrop scrim */}
      {isOpen && (
        <div
          data-slot="sidebar-scrim"
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-xs transition-opacity duration-300"
        />
      )}

      <div
        className={cn(
          "fixed md:absolute inset-y-0 left-0 z-40 w-72 bg-elevated border-r border-default transition-transform duration-300 ease-in-out flex flex-col shadow-2xl",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-default shrink-0">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-medium text-primary">Projects</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 text-muted hover:text-primary"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 p-3 overflow-hidden flex flex-col min-h-0">
          <Tabs defaultValue="my-projects" className="w-full flex-1 flex flex-col min-h-0">
            <TabsList className="bg-subtle w-full grid grid-cols-2 shrink-0">
              <TabsTrigger value="my-projects">My Projects</TabsTrigger>
              <TabsTrigger value="shared">Shared</TabsTrigger>
            </TabsList>

            {/* Owned Projects Tab */}
            <TabsContent value="my-projects" className="flex-1 mt-3 overflow-hidden flex flex-col min-h-0">
              {ownedProjects.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-sm text-muted">
                  <p>No projects yet.</p>
                  <p className="text-xs text-faint mt-1">Create a new project to get started.</p>
                </div>
              ) : (
                <ScrollArea className="flex-1 h-full w-full">
                  <div className="space-y-1.5 py-1 px-1 pr-2">
                    {ownedProjects.map((project) => (
                      <Link
                        key={project.id}
                        href={`/editor/${project.id}`}
                        className="group flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-subtle border border-transparent hover:border-default transition-colors text-left w-full cursor-pointer"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-sm font-medium text-primary truncate">
                            {project.name}
                          </p>
                          <p className="text-[11px] text-muted truncate">
                            {project.updatedAt}
                          </p>
                        </div>

                        {/* Project actions (Owned only, visible only on hover/focus) */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onOpenRename(project);
                            }}
                            className="h-7 w-7 text-muted hover:text-primary hover:bg-elevated rounded-md"
                            title="Rename project"
                            aria-label={`Rename ${project.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onOpenDelete(project);
                            }}
                            className="h-7 w-7 text-muted hover:text-destructive hover:bg-elevated rounded-md"
                            title="Delete project"
                            aria-label={`Delete ${project.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </Link>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            {/* Shared Projects Tab */}
            <TabsContent value="shared" className="flex-1 mt-3 overflow-hidden flex flex-col min-h-0">
              {sharedProjects.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-sm text-muted">
                  <p>No shared projects.</p>
                  <p className="text-xs text-faint mt-1">
                    Shared architecture workspaces will appear here.
                  </p>
                </div>
              ) : (
                <ScrollArea className="flex-1 h-full w-full">
                  <div className="space-y-1.5 py-1 px-1 pr-2">
                    {sharedProjects.map((project) => (
                      <Link
                        key={project.id}
                        href={`/editor/${project.id}`}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-subtle border border-transparent hover:border-default transition-colors text-left w-full cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary truncate flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-ai shrink-0" />
                            <span className="truncate">{project.name}</span>
                          </p>
                          <p className="text-[11px] text-muted truncate">
                            {project.updatedAt}
                          </p>
                        </div>
                        {/* No actions for shared projects */}
                      </Link>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="p-3 border-t border-default bg-elevated shrink-0">
          <Button
            variant="default"
            onClick={onOpenCreate}
            className="w-full gap-2 font-medium"
          >
            <Plus className="h-4 w-4" /> New Project
          </Button>
        </div>
      </div>
    </>
  );
}
