import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { auth as triggerAuth } from "@trigger.dev/sdk";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/ai/design/token
 * Accepts a run ID, verifies ownership via the TaskRun record,
 * generates a Trigger.dev public token scoped to that run, and returns it to the client.
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
  let body: { runId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { runId } = body;
  if (!runId || typeof runId !== "string" || !runId.trim()) {
    return NextResponse.json(
      { error: "runId is required and must be a non-empty string" },
      { status: 400 }
    );
  }

  const cleanRunId = runId.trim();

  // 3. Verify ownership using the TaskRun record
  try {
    const taskRun = await prisma.taskRun.findUnique({
      where: { runId: cleanRunId },
    });

    if (!taskRun) {
      return NextResponse.json(
        { error: "Task run not found" },
        { status: 404 }
      );
    }

    if (taskRun.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this task run" },
        { status: 403 }
      );
    }

    // 4. Generate Trigger.dev public token scoped to that run
    const publicToken = await triggerAuth.createPublicToken({
      scopes: {
        read: {
          runs: [taskRun.runId],
        },
      },
      expirationTime: "1h",
    });

    // 5. Return the token to the client
    return NextResponse.json(
      {
        token: publicToken,
        publicToken,
        runId: taskRun.runId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error generating run public token:", error);
    return NextResponse.json(
      { error: "Failed to generate run token" },
      { status: 500 }
    );
  }
}
