"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectSidebar({ isOpen, onClose }: ProjectSidebarProps) {
  return (
    <div
      className={cn(
        "absolute inset-y-0 left-0 z-40 w-72 bg-elevated border-r border-default transition-transform duration-300 ease-in-out flex flex-col shadow-2xl",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-default">
        <h2 className="text-sm font-medium text-primary">Projects</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6 text-muted hover:text-primary">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        <Tabs defaultValue="my-projects" className="w-full flex-1 flex flex-col">
          <TabsList className="bg-subtle w-full grid grid-cols-2">
            <TabsTrigger value="my-projects">My Projects</TabsTrigger>
            <TabsTrigger value="shared">Shared</TabsTrigger>
          </TabsList>
          
          <TabsContent value="my-projects" className="flex-1 mt-4">
            <div className="h-full flex items-center justify-center text-sm text-muted">
              No projects yet.
            </div>
          </TabsContent>
          
          <TabsContent value="shared" className="flex-1 mt-4">
            <div className="h-full flex items-center justify-center text-sm text-muted">
              No shared projects.
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="p-4 border-t border-default bg-elevated">
        <Button variant="default" className="w-full gap-2">
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>
    </div>
  );
}
