"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Project, generateRoomId, generateShortSuffix } from "@/types/project";

export interface TargetProject {
  id: string;
  name: string;
}

export function useProjectActions() {
  const router = useRouter();
  const pathname = usePathname();

  // Dialog open states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Target project for rename / delete
  const [targetProject, setTargetProject] = useState<TargetProject | null>(null);

  // Form states
  const [projectName, setProjectName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [roomSuffix, setRoomSuffix] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview of Yjs room ID (slug + suffix)
  const slugPreview = useMemo(() => {
    if (!projectName.trim()) return "";
    return generateRoomId(projectName, roomSuffix);
  }, [projectName, roomSuffix]);

  // Dialog open/close actions
  const openCreate = useCallback(() => {
    setProjectName("");
    setRoomSuffix(generateShortSuffix(5));
    setError(null);
    setIsCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setIsCreateOpen(false);
    setProjectName("");
    setRoomSuffix("");
    setError(null);
  }, []);

  const openRename = useCallback((project: TargetProject | Project) => {
    setTargetProject({ id: project.id, name: project.name });
    setRenameName(project.name);
    setError(null);
    setIsRenameOpen(true);
  }, []);

  const closeRename = useCallback(() => {
    setIsRenameOpen(false);
    setTargetProject(null);
    setRenameName("");
    setError(null);
  }, []);

  const openDelete = useCallback((project: TargetProject | Project) => {
    setTargetProject({ id: project.id, name: project.name });
    setError(null);
    setIsDeleteOpen(true);
  }, []);

  const closeDelete = useCallback(() => {
    setIsDeleteOpen(false);
    setTargetProject(null);
    setError(null);
  }, []);

  // Submit Handlers

  // 1. Create Project
  const handleCreate = useCallback(async () => {
    const trimmedName = projectName.trim();
    if (!trimmedName || isLoading) return;

    setIsLoading(true);
    setError(null);

    const roomId = generateRoomId(trimmedName, roomSuffix);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          id: roomId,
          roomId: roomId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create project");
      }

      const createdProject = await response.json();
      const targetId = createdProject?.id || roomId;

      closeCreate();
      router.push(`/editor/${targetId}`);
      router.refresh();
    } catch (err: any) {
      console.error("Create project error:", err);
      setError(err.message || "Failed to create project");
    } finally {
      setIsLoading(false);
    }
  }, [projectName, roomSuffix, isLoading, closeCreate, router]);

  // 2. Rename Project
  const handleRename = useCallback(async () => {
    if (!targetProject || !renameName.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${targetProject.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: renameName.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to rename project");
      }

      closeRename();
      router.refresh();
    } catch (err: any) {
      console.error("Rename project error:", err);
      setError(err.message || "Failed to rename project");
    } finally {
      setIsLoading(false);
    }
  }, [targetProject, renameName, isLoading, closeRename, router]);

  // 3. Delete Project
  const handleDelete = useCallback(async () => {
    if (!targetProject || isLoading) return;

    setIsLoading(true);
    setError(null);

    const deletedProjectId = targetProject.id;

    try {
      const response = await fetch(`/api/projects/${deletedProjectId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete project");
      }

      closeDelete();

      // If active workspace is the deleted project, redirect to /editor
      const isActiveWorkspace =
        pathname === `/editor/${deletedProjectId}` ||
        pathname?.startsWith(`/editor/${deletedProjectId}/`);

      if (isActiveWorkspace) {
        router.push("/editor");
      } else {
        router.refresh();
      }
    } catch (err: any) {
      console.error("Delete project error:", err);
      setError(err.message || "Failed to delete project");
    } finally {
      setIsLoading(false);
    }
  }, [targetProject, isLoading, closeDelete, pathname, router]);

  return {
    // Dialog states
    isCreateOpen,
    isRenameOpen,
    isDeleteOpen,
    targetProject,
    isLoading,
    error,

    // Form states & derived preview
    projectName,
    setProjectName,
    createName: projectName,
    setCreateName: setProjectName,
    slugPreview,
    renameName,
    setRenameName,

    // Modal controllers
    openCreate,
    closeCreate,
    openRename,
    closeRename,
    openDelete,
    closeDelete,

    // Action handlers
    handleCreate,
    handleRename,
    handleDelete,
  };
}

export default useProjectActions;
