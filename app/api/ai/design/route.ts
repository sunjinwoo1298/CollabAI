import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { tasks } from "@trigger.dev/sdk";
import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/project-access";
import type { designAgentTask } from "@/trigger/design-agent";

/**
 * GET /api/ai/design?projectId=...
 * Retrieves the latest active or recent TaskRun for the authenticated user and project.
 * Supports restoring active run state across component remounts and page reloads.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId")?.trim();

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const access = await getProjectAccess(projectId);
    if (!access.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!access.project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (!access.hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this project" },
        { status: 403 }
      );
    }

    // Look up latest TaskRun within the last 15 minutes for this user and project
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const taskRun = await prisma.taskRun.findFirst({
      where: {
        projectId,
        userId,
        createdAt: { gte: fifteenMinutesAgo },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      runId: taskRun?.runId ?? null,
      projectId,
    });
  } catch (error) {
    console.error("Error retrieving active design task run:", error);
    return NextResponse.json(
      { error: "Failed to retrieve active design run" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/design
 * Triggers the Trigger.dev design task, stores the TaskRun tracking record in Prisma,
 * and returns the run ID to the client.
 */
export async function POST(req: NextRequest) {
  // 1. Authenticate via Clerk
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2. Validate request body
  let body: { prompt?: unknown; roomId?: unknown; projectId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { prompt, roomId, projectId } = body;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json(
      { error: "Prompt is required and must be a non-empty string" },
      { status: 400 }
    );
  }

  const cleanPrompt = prompt.trim();
  const rawProjectId = typeof projectId === "string" ? projectId.trim() : "";
  const rawRoomId = typeof roomId === "string" ? roomId.trim() : "";

  if (rawProjectId && rawRoomId && rawProjectId !== rawRoomId) {
    return NextResponse.json(
      { error: "Invariant violation: projectId must equal roomId" },
      { status: 400 }
    );
  }

  const targetProjectId = rawProjectId || rawRoomId;
  const targetRoomId = targetProjectId;

  if (!targetProjectId) {
    return NextResponse.json(
      { error: "projectId or roomId is required" },
      { status: 400 }
    );
  }

  // 3. Verify project access
  try {
    const access = await getProjectAccess(targetProjectId);

    if (!access.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!access.project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!access.hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this project" },
        { status: 403 }
      );
    }

    // 4. Trigger the design task through Trigger.dev
    const handle = await tasks.trigger<typeof designAgentTask>("design-agent", {
      prompt: cleanPrompt,
      roomId: targetRoomId,
      projectId: targetProjectId,
      userId,
    });

    const runId = handle.id;

    // 5. Create TaskRun record in Prisma
    const taskRun = await prisma.taskRun.create({
      data: {
        runId,
        projectId: targetProjectId,
        userId,
      },
    });

    // 6. Return the run ID to the client
    return NextResponse.json(
      {
        runId: taskRun.runId,
        taskId: "design-agent",
        projectId: taskRun.projectId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error triggering design task:", error);
    return NextResponse.json(
      { error: "Failed to trigger design task" },
      { status: 500 }
    );
  }
}
