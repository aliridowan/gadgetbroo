import { checkPermission } from "@/lib/rbac";
import { MediaLibraryService } from "@/lib/services/mediaLibraryService";
import MediaClient from "./MediaClient";

export default async function MediaPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await checkPermission("Media", "canView");
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to view this page.</div>;
  }

  const searchParams = await props.searchParams;
  const pageParam = searchParams.page;
  const page = pageParam
    ? parseInt(Array.isArray(pageParam) ? pageParam[0] : pageParam, 10) || 1
    : 1;

  // Matches MediaClient's default filter state (search="", filter="all")
  // plus whatever `page` the URL currently points at, so the client doesn't
  // immediately re-fetch what we already rendered.
  const { files, totalPages } = await MediaLibraryService.getMediaFiles({ page, limit: 15 });

  // `createdAt` is a Date on the Prisma row; the client's MediaFile type
  // (matching what it already gets back from `fetch("/api/media")`, which
  // goes through real JSON.stringify) expects an ISO string, and `hash`
  // isn't used by the client at all — so shape it explicitly rather than
  // handing the raw service row across.
  const initialFiles = files.map((f) => ({
    fileId: f.fileId,
    name: f.name,
    url: f.url,
    filePath: f.filePath,
    fileType: f.fileType,
    mimeType: f.mimeType,
    size: f.size,
    width: f.width,
    height: f.height,
    createdAt: f.createdAt.toISOString(),
    products: f.products,
  }));

  return <MediaClient initialFiles={initialFiles} initialTotalPages={totalPages} />;
}
