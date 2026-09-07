import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    projectId: string;
    collaboratorId: string;
  }>;
}

/**
 * DELETE /api/projects/[projectId]/collaborators/[collaboratorId]
 * Removes a collaborator from the project. Enforces project ownership server-side.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, collaboratorId } = await params;
    if (!projectId || !collaboratorId) {
      return NextResponse.json(
        { error: "Project ID and Collaborator ID are required" },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Enforce server-side ownership
    if (project.ownerId !== userId) {
      return NextResponse.json(
        { error: "Only the project owner can remove collaborators" },
        { status: 403 }
      );
    }

    const collaborator = await prisma.projectCollaborator.findFirst({
      where: {
        id: collaboratorId,
        projectId,
      },
    });

    if (!collaborator) {
      return NextResponse.json(
        { error: "Collaborator not found on this project" },
        { status: 404 }
      );
    }

    await prisma.projectCollaborator.delete({
      where: {
        id: collaboratorId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Collaborator removed successfully",
    });
  } catch (error: any) {
    console.error("Error removing project collaborator:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to remove collaborator" },
      { status: 500 }
    );
  }
}
