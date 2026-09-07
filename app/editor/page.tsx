import { getEditorProjects } from "@/lib/projects";
import { EditorHomeClient } from "@/components/editor/editor-home-client";

export const dynamic = "force-dynamic";

export default async function EditorHomePage() {
  const { ownedProjects, sharedProjects } = await getEditorProjects();

  return (
    <EditorHomeClient
      initialOwnedProjects={ownedProjects}
      initialSharedProjects={sharedProjects}
    />
  );
}
