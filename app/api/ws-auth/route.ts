import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getDeterministicColor } from "@/lib/collaboration-color";
import { signRoomToken } from "@/lib/room-jwt";
import { CollaborationRole, UserMeta } from "@/types/collaboration";

export async function POST(req: NextRequest) {
  // 1. Authenticate via Clerk
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2. Validate Request Payload
  let body: { projectId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { projectId } = body;
  if (!projectId || typeof projectId !== "string" || !projectId.trim()) {
    return NextResponse.json(
      { error: "projectId is required and must be a non-empty string" },
      { status: 400 }
    );
  }

  const cleanProjectId = projectId.trim();

  // 3. Fetch Project from PostgreSQL via Prisma
  try {
    const project = await prisma.project.findUnique({
      where: { id: cleanProjectId },
      include: { collaborators: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // 4. Check Membership (Owner or Collaborator)
    const user = await currentUser();
    const emails =
      user?.emailAddresses
        ?.map((e) => e.emailAddress.toLowerCase().trim())
        .filter(Boolean) || [];

    const isOwner = project.ownerId === userId;
    const isCollaborator = project.collaborators.some((c) =>
      emails.includes(c.email.toLowerCase().trim())
    );

    if (!isOwner && !isCollaborator) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this project" },
        { status: 403 }
      );
    }

    // 5. Determine User Role
    const role: CollaborationRole = isOwner ? "owner" : "collaborator";

    // 6. User Metadata & Deterministic Color
    const displayName =
      user?.fullName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
      "Anonymous User";

    const avatar = user?.imageUrl || "";
    const color = getDeterministicColor(userId);

    const userMeta: UserMeta = {
      userId,
      name: displayName,
      avatar,
      color,
    };

    // 7. Generate Room JWT (Enforces Invariant 1: project.id === roomId)
    const token = signRoomToken({
      sub: userId,
      projectId: project.id,
      roomId: project.id,
      role,
      userMeta,
    });

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:1234";

    // 8. Return response
    return NextResponse.json({
      token,
      wsUrl,
    });
  } catch (error) {
    console.error("Error generating WebSocket room token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
