import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    projectId: string;
  }>;
}

/**
 * GET /api/projects/[projectId]/collaborators
 * Lists all collaborators for a project, enriched with Clerk names and avatars.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        collaborators: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const user = await currentUser();
    const userEmails =
      user?.emailAddresses
        ?.map((e) => e.emailAddress.toLowerCase().trim())
        .filter(Boolean) || [];

    const isOwner = project.ownerId === userId;
    const isCollaborator = project.collaborators.some((c) =>
      userEmails.includes(c.email.toLowerCase().trim())
    );

    if (!isOwner && !isCollaborator) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this project" },
        { status: 403 }
      );
    }

    const client = await clerkClient();

    // 1. Fetch Owner Profile
    let ownerInfo = {
      id: project.ownerId,
      name: "Owner",
      email: "",
      imageUrl: null as string | null,
    };

    try {
      const clerkOwner = await client.users.getUser(project.ownerId);
      const ownerPrimaryEmail =
        clerkOwner.emailAddresses.find((e) => e.id === clerkOwner.primaryEmailAddressId)
          ?.emailAddress ||
        clerkOwner.emailAddresses[0]?.emailAddress ||
        "";
      const ownerName =
        [clerkOwner.firstName, clerkOwner.lastName].filter(Boolean).join(" ").trim() ||
        clerkOwner.username ||
        ownerPrimaryEmail;

      ownerInfo = {
        id: project.ownerId,
        name: ownerName,
        email: ownerPrimaryEmail,
        imageUrl: clerkOwner.imageUrl || null,
      };
    } catch (e) {
      console.error("Could not fetch owner profile from Clerk:", e);
    }

    // 2. Fetch and Enrich Collaborator Profiles
    const emails = project.collaborators.map((c) => c.email);
    const userMap = new Map<string, { name: string | null; imageUrl: string | null }>();

    if (emails.length > 0) {
      try {
        const usersResponse = await client.users.getUserList({
          emailAddress: emails,
          limit: 100,
        });
        const users =
          usersResponse.data ?? (Array.isArray(usersResponse) ? usersResponse : []);
        for (const u of users) {
          const name =
            [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
            u.username ||
            null;
          for (const emailObj of u.emailAddresses || []) {
            userMap.set(emailObj.emailAddress.toLowerCase().trim(), {
              name,
              imageUrl: u.imageUrl || null,
            });
          }
        }
      } catch (err) {
        console.error("Could not enrich collaborators from Clerk:", err);
      }
    }

    const enrichedCollaborators = project.collaborators.map((c) => {
      const enriched = userMap.get(c.email.toLowerCase().trim());
      return {
        id: c.id,
        email: c.email,
        name: enriched?.name || null,
        imageUrl: enriched?.imageUrl || null,
        createdAt: c.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      isOwner,
      owner: ownerInfo,
      collaborators: enrichedCollaborators,
    });
  } catch (error: any) {
    console.error("Error listing project collaborators:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[projectId]/collaborators
 * Invites a new collaborator by email. Enforces project ownership server-side.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const rawEmail = typeof body?.email === "string" ? body.email.trim() : "";

    if (!rawEmail || !rawEmail.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = rawEmail.toLowerCase();

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { collaborators: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Enforce server-side ownership
    if (project.ownerId !== userId) {
      return NextResponse.json(
        { error: "Only the project owner can invite collaborators" },
        { status: 403 }
      );
    }

    // Prevent owner from inviting themselves
    const currentUserObj = await currentUser();
    const ownerEmails =
      currentUserObj?.emailAddresses
        ?.map((e) => e.emailAddress.toLowerCase().trim())
        .filter(Boolean) || [];

    if (ownerEmails.includes(normalizedEmail)) {
      return NextResponse.json(
        { error: "You are the owner of this project and cannot invite yourself" },
        { status: 400 }
      );
    }

    // Prevent duplicate invitations
    const existing = project.collaborators.find(
      (c) => c.email.toLowerCase().trim() === normalizedEmail
    );
    if (existing) {
      return NextResponse.json(
        { error: "This email has already been added as a collaborator" },
        { status: 409 }
      );
    }

    const newCollaborator = await prisma.projectCollaborator.create({
      data: {
        projectId,
        email: normalizedEmail,
      },
    });

    // Enrich with Clerk user profile if registered
    const client = await clerkClient();
    let name: string | null = null;
    let imageUrl: string | null = null;

    try {
      const usersRes = await client.users.getUserList({
        emailAddress: [normalizedEmail],
        limit: 1,
      });
      const u = (usersRes.data ?? (Array.isArray(usersRes) ? usersRes : []))[0];
      if (u) {
        name =
          [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
          u.username ||
          null;
        imageUrl = u.imageUrl || null;
      }
    } catch (e) {
      console.error("Could not fetch Clerk user for newly invited collaborator:", e);
    }

    return NextResponse.json(
      {
        collaborator: {
          id: newCollaborator.id,
          email: newCollaborator.email,
          name,
          imageUrl,
          createdAt: newCollaborator.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error inviting project collaborator:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to invite collaborator" },
      { status: 500 }
    );
  }
}
