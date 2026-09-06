"use client";

import { useState, useMemo } from "react";
import { Project, slugifyProjectName } from "@/types/project";
import { INITIAL_OWNED_PROJECTS, INITIAL_SHARED_PROJECTS } from "@/lib/mock-projects";

export function useProjectDialogs() {
  const [ownedProjects, setOwnedProjects] = useState<Project[]>(INITIAL_OWNED_PROJECTS);
  const [sharedProjects] = useState<Project[]>(INITIAL_SHARED_PROJECTS);

  // Dialog open states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Target project for rename / delete
  const [targetProject, setTargetProject] = useState<Project | null>(null);

  // Form states
  const [createName, setCreateName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Slug preview computed live from createName
  const slugPreview = useMemo(() => {
    return slugifyProjectName(createName);
  }, [createName]);

  // Actions
  const openCreate = () => {
    setCreateName("");
    setIsCreateOpen(true);
  };

  const closeCreate = () => {
    setIsCreateOpen(false);
    setCreateName("");
  };

  const openRename = (project: Project) => {
    setTargetProject(project);
    setRenameName(project.name);
    setIsRenameOpen(true);
  };

  const closeRename = () => {
    setIsRenameOpen(false);
    setTargetProject(null);
    setRenameName("");
  };

  const openDelete = (project: Project) => {
    setTargetProject(project);
    setIsDeleteOpen(true);
  };

  const closeDelete = () => {
    setIsDeleteOpen(false);
    setTargetProject(null);
  };

  // Submit handlers
  const handleCreate = async () => {
    if (!createName.trim()) return;
    setIsLoading(true);
    
    // Simulate brief creation delay
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: createName.trim(),
      slug: slugifyProjectName(createName.trim()),
      updatedAt: "Just now",
      isOwner: true,
    };

    setOwnedProjects((prev) => [newProject, ...prev]);
    setIsLoading(false);
    closeCreate();
  };

  const handleRename = async () => {
    if (!targetProject || !renameName.trim()) return;
    setIsLoading(true);

    const updatedName = renameName.trim();
    setOwnedProjects((prev) =>
      prev.map((p) =>
        p.id === targetProject.id
          ? { ...p, name: updatedName, slug: slugifyProjectName(updatedName), updatedAt: "Just now" }
          : p
      )
    );

    setIsLoading(false);
    closeRename();
  };

  const handleDelete = async () => {
    if (!targetProject) return;
    setIsLoading(true);

    setOwnedProjects((prev) => prev.filter((p) => p.id !== targetProject.id));

    setIsLoading(false);
    closeDelete();
  };

  return {
    // Project lists
    ownedProjects,
    sharedProjects,

    // Dialog state
    isCreateOpen,
    isRenameOpen,
    isDeleteOpen,
    targetProject,
    isLoading,

    // Form inputs
    createName,
    setCreateName,
    slugPreview,
    renameName,
    setRenameName,

    // Dialog controllers
    openCreate,
    closeCreate,
    openRename,
    closeRename,
    openDelete,
    closeDelete,

    // Submissions
    handleCreate,
    handleRename,
    handleDelete,
  };
}
