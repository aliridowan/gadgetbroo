import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "../../../../lib/auth";
import prisma from "../../../../lib/prisma";
import { MediaService } from "@/lib/services/mediaService";
import { MediaLibraryService } from "@/lib/services/mediaLibraryService";


import { checkPermission } from "@/lib/rbac";

/**
 * GET /api/media
 *
 * Reads EXCLUSIVELY from PostgreSQL — zero Garage API calls.
 * 5ms Postgres query vs a network round-trip to Garage.
 *
 * Query params:
 *   search  — filter by filename (case-insensitive contains)
 *   type    — "image" | "video" | omit for all
 *   limit   — max results (default 60, max 100)
 *   skip    — pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const session = await checkPermission("Media", "canView");
    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    const result = await MediaLibraryService.getMediaFiles({
      search: searchParams.get("search") ?? undefined,
      type: searchParams.get("type") ?? undefined, // "image" | "video" | undefined
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    });

    return NextResponse.json({ files: result.files, total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages });
  } catch (error) {
    console.error("Media GET error:", error);
    return NextResponse.json(
      { error: "Failed to load media library" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/media
 *
 * Registers a newly uploaded Garage (S3-compatible) asset in PostgreSQL.
 * Called by MediaPickerDialog after a successful direct-to-Garage upload.
 *
 * Body: { url, fileId, name, filePath, fileType, mimeType, size, width, height, hash }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await checkPermission("Media", "canCreate");
    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await request.json();

    if (!data.url || !data.fileId || !data.name) {
      return NextResponse.json(
        { error: "url, fileId, and name are required" },
        { status: 400 }
      );
    }

    // Upsert by fileId — idempotent in case of network retry
    const newMedia = await prisma.mediaFile.upsert({
      where: { fileId: data.fileId },
      update: {
        url: data.url,
        name: data.name,
        filePath: data.filePath || "/gadgetbroo/products",
        fileType: data.fileType || "image",
        mimeType: data.mimeType || null,
        size: data.size || 0,
        width: data.width || null,
        height: data.height || null,
        hash: data.hash || null,
      },
      create: {
        url: data.url,
        fileId: data.fileId,
        name: data.name,
        filePath: data.filePath || "/gadgetbroo/products",
        fileType: data.fileType || "image",
        mimeType: data.mimeType || null,
        size: data.size || 0,
        width: data.width || null,
        height: data.height || null,
        hash: data.hash || null,
      },
    });

    return NextResponse.json({ success: true, file: newMedia }, { status: 201 });
  } catch (error) {
    console.error("Media POST error:", error);
    return NextResponse.json(
      { error: "Failed to register media asset" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/media
 *
 * Deletes from both Garage storage and PostgreSQL.
 * Blocked if the file is still linked to any product.
 *
 * Body: { fileId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await checkPermission("Media", "canDelete");
    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { fileId } = await request.json();
    if (!fileId) {
      return NextResponse.json({ error: "fileId is required" }, { status: 400 });
    }

    // Block deletion if still used by a product
    const linked = await prisma.productImage.findFirst({
      where: { mediaFile: { fileId } },
      select: { id: true, product: { select: { name: true } } },
    });

    if (linked) {
      return NextResponse.json(
        {
          error: `File is used by product "${linked.product.name}". Remove it from the product before deleting.`,
        },
        { status: 400 }
      );
    }

    // Delete from Garage storage first, then clean DB record
    await MediaService.deleteFile(fileId);
    await prisma.mediaFile.delete({ where: { fileId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Media DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete media asset" },
      { status: 500 }
    );
  }
}
