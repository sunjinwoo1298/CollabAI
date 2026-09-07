import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await prisma.project.findMany({
      where: {
        ownerId: userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        collaborators: true,
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let name = "Untitled Project";
    let description: string | undefined;

    try {
      const body = await req.json();
      if (body && typeof body.name === "string" && body.name.trim().length > 0) {
        name = body.name.trim();
      }
      if (body && typeof body.description === "string" && body.description.trim().length > 0) {
        description = body.description.trim();
      }
    } catch {
      // If request body is empty or not JSON, default name remains "Untitled Project"
    }

    const project = await prisma.project.create({
      data: {
        name,
        ownerId: userId,
        description,
      },
      include: {
        collaborators: true,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
