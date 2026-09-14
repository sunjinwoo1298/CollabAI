import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/project-access";
import { put, get } from "@vercel/blob";
import { CanvasNode, CanvasEdge } from "@/types/canvas";

interface RouteParams {
  params: Promise<{
    projectId: string;
  }>;
}

/**
 * Sanitizes and validates canvas nodes, ensuring only persistent fields are saved.
 */
function sanitizeNodes(nodes: unknown[]): CanvasNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter((n): n is CanvasNode => {
      return (
        n !== null &&
        typeof n === "object" &&
        typeof (n as any).id === "string" &&
        typeof (n as any).position === "object" &&
        typeof (n as any).position?.x === "number" &&
        typeof (n as any).position?.y === "number" &&
        typeof (n as any).data === "object"
      );
    })
    .map((n) => ({
      id: String(n.id),
      type: "system",
      position: {
        x: Number(n.position.x),
        y: Number(n.position.y),
      },
      data: {
        label: String(n.data.label || ""),
        sublabel: n.data.sublabel ? String(n.data.sublabel) : undefined,
        nodeType: n.data.nodeType || "service",
        icon: n.data.icon ? String(n.data.icon) : undefined,
        description: n.data.description ? String(n.data.description) : undefined,
        status: n.data.status || "active",
        metadata: n.data.metadata || undefined,
      },
    }));
}

/**
 * Sanitizes and validates canvas edges.
 */
function sanitizeEdges(edges: unknown[]): CanvasEdge[] {
  if (!Array.isArray(edges)) return [];
  return edges
    .filter((e): e is CanvasEdge => {
      return (
        e !== null &&
        typeof e === "object" &&
        typeof (e as any).id === "string" &&
        typeof (e as any).source === "string" &&
        typeof (e as any).target === "string"
      );
    })
    .map((e) => ({
      id: String(e.id),
      source: String(e.source),
      target: String(e.target),
      sourceHandle: e.sourceHandle ? String(e.sourceHandle) : undefined,
      targetHandle: e.targetHandle ? String(e.targetHandle) : undefined,
      type: e.type || "smoothstep",
      animated: typeof e.animated === "boolean" ? e.animated : true,
      style: e.style || { stroke: "#64748B", strokeWidth: 2 },
    }));
}

/**
 * PUT /api/projects/[projectId]/canvas
 * Persists serialized canvas state to Vercel Blob and records URL in PostgreSQL.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  if (!projectId) {
    return NextResponse.json(
      { error: "Project ID is required" },
      { status: 400 }
    );
  }

  try {
    const access = await getProjectAccess(projectId);

    if (!access.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const body = await req.json();
    if (!body || !Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
      return NextResponse.json(
        { error: "Invalid canvas payload: 'nodes' and 'edges' must be arrays" },
        { status: 400 }
      );
    }

    const cleanedNodes = sanitizeNodes(body.nodes);
    const cleanedEdges = sanitizeEdges(body.edges);

    const serialized = JSON.stringify({
      nodes: cleanedNodes,
      edges: cleanedEdges,
    });

    // Stable project-specific Blob path
    const blobPath = `canvas/${projectId}.json`;

    const blob = await put(blobPath, serialized, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });

    // Update database record with Blob URL reference if changed
    if (access.project.canvasJsonPath !== blob.url) {
      await prisma.project.update({
        where: { id: projectId },
        data: { canvasJsonPath: blob.url },
      });
    }

    return NextResponse.json({
      success: true,
      url: blob.url,
      nodeCount: cleanedNodes.length,
      edgeCount: cleanedEdges.length,
    });
  } catch (error: any) {
    console.error(`[Canvas Storage API] Failed to save canvas for ${projectId}:`, error);
    return NextResponse.json(
      { error: error?.message || "Internal server error saving canvas" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[projectId]/canvas
 * Retrieves durable canvas state from Vercel Blob.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  if (!projectId) {
    return NextResponse.json(
      { error: "Project ID is required" },
      { status: 400 }
    );
  }

  try {
    const access = await getProjectAccess(projectId);

    if (!access.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    if (!access.project.canvasJsonPath) {
      return NextResponse.json({
        nodes: [],
        edges: [],
      });
    }

    let data: any = null;

    try {
      const blobResult = await get(access.project.canvasJsonPath, {
        access: "private",
        token: process.env.BLOB_READ_WRITE_TOKEN,
        useCache: false,
      });

      if (blobResult && blobResult.stream) {
        data = await new Response(blobResult.stream).json();
      }
    } catch (sdkError: any) {
      console.warn(
        `[Canvas Storage API] Blob get error for ${projectId}:`,
        sdkError?.message
      );

      // Fallback to authenticated fetch
      const blobRes = await fetch(access.project.canvasJsonPath, {
        cache: "no-store",
        headers: process.env.BLOB_READ_WRITE_TOKEN
          ? { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
          : {},
      });

      if (blobRes.ok) {
        data = await blobRes.json();
      }
    }

    const nodes = sanitizeNodes(data?.nodes);
    const edges = sanitizeEdges(data?.edges);

    return NextResponse.json({
      nodes,
      edges,
    });
  } catch (error: any) {
    console.error(`[Canvas Storage API] Failed to get canvas for ${projectId}:`, error);
    return NextResponse.json(
      { error: error?.message || "Internal server error fetching canvas" },
      { status: 500 }
    );
  }
}
