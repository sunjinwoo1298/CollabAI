import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
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
      redisPubClient.on("error", (err) => {
        console.warn("[POST messages] Redis publisher connection warning:", err.message);
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

    // Derive trusted sender identity from access.user (zero redundant Clerk network calls)
    let displayName =
      access.user?.name ||
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

    // Determine stable message ID (client-provided for idempotency or server-generated)
    const messageId =
      validation.input.id?.trim() ||
      (clientRunId
        ? `msg_ai_${clientRunId}`
        : `msg_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`);

    // Check if message was already created (idempotent request handling)
    const existing = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    let record;
    let isNewMessage = false;

    if (existing) {
      if (existing.projectId !== cleanProjectId) {
        return NextResponse.json(
          { error: "Conflict: Message ID already exists in another project" },
          { status: 409 }
        );
      }
      record = existing;
    } else {
      try {
        record = await prisma.chatMessage.create({
          data: {
            id: messageId,
            projectId: cleanProjectId,
            senderId,
            sender: displayName,
            role: "user",
            content,
          },
        });
        isNewMessage = true;
      } catch (dbErr: any) {
        if (dbErr.code === "P2002") {
          // Handled concurrent idempotent retry
          record = await prisma.chatMessage.findUnique({
            where: { id: messageId },
          });
          if (!record) throw dbErr;
        } else {
          throw dbErr;
        }
      }
    }

    const message: RoomChatMessage = {
      id: record.id,
      projectId: record.projectId,
      senderId: record.senderId,
      sender: record.sender,
      role: "user",
      content: record.content,
      timestamp: record.createdAt.toISOString(),
    };

    // Broadcast through Redis pub/sub for multi-instance fan-out ONLY for brand-new messages
    if (isNewMessage) {
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
    }

    return NextResponse.json(message, { status: isNewMessage ? 201 : 200 });
  } catch (err: any) {
    console.error("[POST /api/projects/[projectId]/messages] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to send message" },
      { status: 500 }
    );
  }
}
