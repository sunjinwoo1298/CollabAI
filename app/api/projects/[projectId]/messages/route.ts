import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/project-access";
import {
  RoomChatMessage,
  validateSendChatInput,
} from "@/types/collaboration";
import Redis from "ioredis";

interface RouteParams {
  params: Promise<{
    projectId: string;
  }>;
}

// Optional helper to publish to Redis if REDIS_URL is configured
let redisPubClient: Redis | null = null;
function getRedisPub(): Redis | null {
  if (redisPubClient) return redisPubClient;
  if (process.env.REDIS_URL) {
    try {
      redisPubClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
      });
    } catch {
      redisPubClient = null;
    }
  }
  return redisPubClient;
}

/**
 * GET /api/projects/[projectId]/messages
 * Retrieves room chat message history for an authorized project.
 */
export async function GET(req: NextRequest, props: RouteParams) {
  try {
    const { projectId } = await props.params;
    const cleanProjectId = (projectId || "").trim();

    if (!cleanProjectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const access = await getProjectAccess(cleanProjectId);
    if (!access.authenticated) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!access.project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (!access.hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this project" },
        { status: 403 }
      );
    }

    const records = await prisma.chatMessage.findMany({
      where: { projectId: cleanProjectId },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    const messages: RoomChatMessage[] = records.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      senderId: r.senderId,
      sender: r.sender,
      role: "user",
      content: r.content,
      timestamp: r.createdAt.toISOString(),
    }));

    return NextResponse.json({ messages });
  } catch (err: any) {
    console.error("[GET /api/projects/[projectId]/messages] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to retrieve messages" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[projectId]/messages
 * Submits a new room chat message, persists to PostgreSQL, and broadcasts via Redis.
 */
export async function POST(req: NextRequest, props: RouteParams) {
  try {
    const { projectId } = await props.params;
    const cleanProjectId = (projectId || "").trim();

    if (!cleanProjectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const access = await getProjectAccess(cleanProjectId);
    if (!access.authenticated) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!access.project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (!access.hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this project" },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const validation = validateSendChatInput(body);
    if (!validation.valid || !validation.input) {
      return NextResponse.json(
        { error: validation.error || "Invalid chat content" },
        { status: 400 }
      );
    }

    // Derive trusted sender identity
    const clerkUser = await currentUser();
    let displayName =
      clerkUser?.fullName ||
      [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
      clerkUser?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
      access.user?.email?.split("@")[0] ||
      "Anonymous User";

    let senderId = access.user!.userId;

    // If runId is provided, verify ownership of the TaskRun to authorize AI message
    const clientRunId = validation.input.runId?.trim();
    if (clientRunId) {
      const taskRun = await prisma.taskRun.findUnique({
        where: { runId: clientRunId },
      });

      if (
        taskRun &&
        taskRun.userId === access.user!.userId &&
        taskRun.projectId === cleanProjectId
      ) {
        senderId = "ai-agent";
        displayName = "Collab AI";
      } else {
        return NextResponse.json(
          { error: "Forbidden: You do not own this design run" },
          { status: 403 }
        );
      }
    }

    const content = validation.input.content;

    // Create durable record in PostgreSQL
    const created = await prisma.chatMessage.create({
      data: {
        projectId: cleanProjectId,
        senderId,
        sender: displayName,
        role: "user",
        content,
      },
    });

    const message: RoomChatMessage = {
      id: created.id,
      projectId: created.projectId,
      senderId: created.senderId,
      sender: created.sender,
      role: "user",
      content: created.content,
      timestamp: created.createdAt.toISOString(),
    };

    // Broadcast through Redis pub/sub for multi-instance fan-out if available
    const redis = getRedisPub();
    if (redis) {
      try {
        await redis.publish(
          `yjs:room:${cleanProjectId}`,
          JSON.stringify({
            serverId: "next_api",
            roomId: cleanProjectId,
            type: "chat",
            payload: JSON.stringify(message),
            timestamp: Date.now(),
          })
        );
      } catch (redisErr) {
        console.warn("[POST messages] Redis pub/sub warning:", redisErr);
      }
    }

    return NextResponse.json(message, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/projects/[projectId]/messages] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to send message" },
      { status: 500 }
    );
  }
}
