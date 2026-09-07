import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { Project } from "@/types/project";

export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "Just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return "Yesterday";
  }
  if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export interface EditorProjectsData {
  ownedProjects: Project[];
  sharedProjects: Project[];
}

export async function getEditorProjects(): Promise<EditorProjectsData> {
  const { userId } = await auth();

  if (!userId) {
    return {
      ownedProjects: [],
      sharedProjects: [],
    };
  }

  try {
    const user = await currentUser();
    const userEmails =
      user?.emailAddresses
        ?.map((e) => e.emailAddress.toLowerCase().trim())
        .filter(Boolean) || [];

    const [ownedDbProjects, sharedDbProjects] = await Promise.all([
      prisma.project.findMany({
        where: {
          ownerId: userId,
        },
        orderBy: {
          updatedAt: "desc",
        },
        include: {
          collaborators: true,
        },
      }),
      userEmails.length > 0
        ? prisma.project.findMany({
            where: {
              collaborators: {
                some: {
                  email: {
                    in: userEmails,
                  },
                },
              },
              ownerId: {
                not: userId,
              },
            },
            orderBy: {
              updatedAt: "desc",
            },
            include: {
              collaborators: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const ownedProjects: Project[] = ownedDbProjects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.id,
      description: p.description,
      updatedAt: formatRelativeTime(p.updatedAt),
      createdAt: p.createdAt.toISOString(),
      isOwner: true,
    }));

    const sharedProjects: Project[] = sharedDbProjects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.id,
      description: p.description,
      updatedAt: formatRelativeTime(p.updatedAt),
      createdAt: p.createdAt.toISOString(),
      isOwner: false,
    }));

    return {
      ownedProjects,
      sharedProjects,
    };
  } catch (error) {
    console.error("Failed to fetch editor projects:", error);
    return {
      ownedProjects: [],
      sharedProjects: [],
    };
  }
}
