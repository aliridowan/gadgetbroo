import prisma from "@/lib/prisma";

// Separate from mediaService.ts on purpose — per AGENTS.md, mediaService.ts
// is scoped to talking to Garage/S3 storage itself (upload/delete/build key)
// and should stay the only file that needs new logic if the storage
// provider ever changes again. Listing/searching what's already indexed in
// Postgres is a different concern (DB query, not storage I/O), so it lives
// here instead.

export type GetMediaFilesParams = {
  search?: string;
  type?: string; // "image" | "video" | undefined (all)
  page?: number;
  limit?: number;
};

export type MediaLibraryFile = {
  fileId: string;
  name: string;
  url: string;
  filePath: string;
  fileType: string;
  mimeType: string | null;
  size: number;
  width: number | null;
  height: number | null;
  hash: string | null;
  createdAt: Date;
  products: { id: string; name: string; slug: string; isPrimary: boolean }[];
};

export type GetMediaFilesResult = {
  files: MediaLibraryFile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * MediaLibraryService — single source of truth for the admin media library
 * query. Called both by GET /api/media (client-side re-fetch on
 * search/filter/page change) and directly by media/page.tsx (initial page
 * load), same reasoning as ProductService/CategoryService/AnalyticsService.
 */
export const MediaLibraryService = {
  async getMediaFiles(params: GetMediaFilesParams = {}): Promise<GetMediaFilesResult> {
    const { search = "", type, page = 1, limit = 60 } = params;
    const cappedLimit = Math.min(limit, 100);
    const skip = (page - 1) * cappedLimit;

    const where = {
      AND: [
        search ? { name: { contains: search, mode: "insensitive" as const } } : {},
        type ? { fileType: type } : {},
      ],
    };

    const [files, total] = await Promise.all([
      prisma.mediaFile.findMany({
        where,
        take: cappedLimit,
        skip,
        orderBy: { createdAt: "desc" },
        include: {
          images: {
            select: {
              isPrimary: true,
              product: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      prisma.mediaFile.count({ where }),
    ]);

    const formattedFiles: MediaLibraryFile[] = files.map((f) => ({
      fileId: f.fileId,
      name: f.name,
      url: f.url,
      filePath: f.filePath,
      fileType: f.fileType,
      mimeType: f.mimeType,
      size: f.size,
      width: f.width,
      height: f.height,
      hash: f.hash,
      createdAt: f.createdAt,
      products: f.images.map((img) => ({
        id: img.product.id,
        name: img.product.name,
        slug: img.product.slug,
        isPrimary: img.isPrimary,
      })),
    }));

    return {
      files: formattedFiles,
      total,
      page,
      limit: cappedLimit,
      totalPages: Math.ceil(total / cappedLimit),
    };
  },
};
