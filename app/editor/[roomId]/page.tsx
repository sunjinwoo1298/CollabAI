import { redirect } from "next/navigation";
import { getProjectAccess } from "@/lib/project-access";
import { getEditorProjects } from "@/lib/projects";
import { AccessDenied } from "@/components/editor/access-denied";
import { WorkspaceShell } from "@/components/editor/workspace-shell";

export const dynamic = "force-dynamic";

interface ProjectWorkspacePageProps {
  params: Promise<{
    roomId: string;
  }>;
}

export default async function ProjectWorkspacePage({
  params,
}: ProjectWorkspacePageProps) {
  const { roomId } = await params;

  // 1. Perform server-side access check
  const access = await getProjectAccess(roomId);

  // Unauthenticated users redirect to /sign-in
  if (!access.authenticated) {
    redirect("/sign-in");
  }

  // Missing or unauthorized projects show AccessDenied
  if (!access.hasAccess || !access.project) {
    return <AccessDenied />;
  }

  // 2. Fetch project lists for the sidebar
  const { ownedProjects, sharedProjects } = await getEditorProjects();

  // 3. Render full-viewport workspace shell
  return (
    <WorkspaceShell
      project={{
        id: access.project.id,
        name: access.project.name,
        description: access.project.description,
        ownerId: access.project.ownerId,
        isOwner: access.isOwner,
      }}
      ownedProjects={ownedProjects}
      sharedProjects={sharedProjects}
    />
  );
}
