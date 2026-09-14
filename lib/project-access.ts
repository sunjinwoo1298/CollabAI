import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export interface ClerkIdentity {
  userId: string;
  email: string | null;
  emails: string[];
}

export interface ProjectAccessResult {
  authenticated: boolean;
  hasAccess: boolean;
  isOwner: boolean;
  project: {
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    canvasJsonPath: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  user: ClerkIdentity | null;
}

/**
 * Retrieves the currently authenticated Clerk user's identity details.
 */
export async function getCurrentUserIdentity(): Promise<ClerkIdentity | null> {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const user = await currentUser();
    const primaryEmail =
      user?.emailAddresses?.find((e) => e.id === user?.primaryEmailAddressId)?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      null;

    const emails =
      user?.emailAddresses
        ?.map((e) => e.emailAddress.toLowerCase().trim())
        .filter(Boolean) || [];

    return {
      userId,
      email: primaryEmail,
      emails,
    };
  } catch (error) {
    console.error("Failed to get current user identity from Clerk:", error);
    return {
      userId,
      email: null,
      emails: [],
    };
  }
}

/**
 * Checks if the current user has access to a project by room/project ID (as owner or collaborator).
 */
export async function getProjectAccess(roomId: string): Promise<ProjectAccessResult> {
  if (!roomId) {
    return {
      authenticated: false,
      hasAccess: false,
      isOwner: false,
      project: null,
      user: null,
    };
  }

  const user = await getCurrentUserIdentity();
  if (!user) {
    return {
      authenticated: false,
      hasAccess: false,
      isOwner: false,
      project: null,
      user: null,
    };
  }

  try {
    const project = await prisma.project.findUnique({
      where: {
        id: roomId,
      },
      include: {
        collaborators: true,
      },
    });

    if (!project) {
      return {
        authenticated: true,
        hasAccess: false,
        isOwner: false,
        project: null,
        user,
      };
    }

    const isOwner = project.ownerId === user.userId;
    const isCollaborator = project.collaborators.some((c) =>
      user.emails.includes(c.email.toLowerCase().trim())
    );

    if (isOwner || isCollaborator) {
      return {
        authenticated: true,
        hasAccess: true,
        isOwner,
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          ownerId: project.ownerId,
          canvasJsonPath: project.canvasJsonPath,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
        user,
      };
    }

    return {
      authenticated: true,
      hasAccess: false,
      isOwner: false,
      project: null,
      user,
    };
  } catch (error) {
    console.error("Error checking project access:", error);
    return {
      authenticated: true,
      hasAccess: false,
      isOwner: false,
      project: null,
      user,
    };
  }
}
