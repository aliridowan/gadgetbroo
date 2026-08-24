"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Trash2, Search, ImageIcon, Film, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MediaPickerDialog,
  type MediaFileRecord,
} from "@/components/admin/media/MediaPickerDialog";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import URLPagination from "@/components/URLPagination";

type MediaFile = {
  fileId: string;
  name: string;
  url: string;
  filePath: string;
  fileType: string;
  mimeType?: string | null;
  size: number;
  width?: number | null;
  height?: number | null;
  createdAt?: string | null;
  products: { id: string; name: string; slug: string; isPrimary: boolean }[];
};

export default function MediaClient({
  initialFiles,
  initialTotalPages,
}: {
  initialFiles: MediaFile[];
  initialTotalPages: number;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [files, setFiles] = useState<MediaFile[]>(initialFiles);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const page = Number(searchParams.get("page")) || 1;
  const [totalPages, setTotalPages] = useState(initialTotalPages);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filter !== "all") params.set("type", filter);
      params.set("limit", "15");
      params.set("page", page.toString());

      const res = await fetch(`/api/media?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setFiles(data.files ?? []);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load media");
    } finally {
      setLoading(false);
    }
  }, [search, filter, page]);

  // The server already fetched data matching the defaults above (page=<from
  // URL>, search="", filter="all"), so skip the very first effect run — it
  // would just re-request the exact same page.
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    fetchMedia();
  }, [fetchMedia]);

  const handleDelete = async (file: MediaFile) => {
    if (file.products.length > 0) {
      toast.error(
        `Used by: ${file.products.map((p) => p.name).join(", ")} — unlink from all products first`
      );
      return;
    }
    if (!confirm(`Delete "${file.name}" permanently from Garage storage?`)) return;

    setDeletingId(file.fileId);
    try {
      const res = await fetch("/api/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.fileId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Delete failed");
        return;
      }
      toast.success("Deleted successfully");
      setFiles((prev) => prev.filter((f) => f.fileId !== file.fileId));
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeletingId(null);
    }
  };

  const handlePickerSelect = (selected: MediaFileRecord | MediaFileRecord[]) => {
    // After uploading via picker, refresh the grid so new files appear
    fetchMedia();
    toast.success("Media library updated");
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const updateFilter = () => {
    const params = new URLSearchParams(searchParams);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col">
      <div className="max-w-[1400px] w-full mx-auto flex flex-col flex-1 space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Media Library</h1>
            <p className="text-sm text-muted-foreground mt-1">
              All assets indexed in database from Garage{" "}
              <code className="text-muted-foreground">/gadgetbroo</code>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchMedia}
              disabled={loading}
              className="border-border text-muted-foreground"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
            </Button>
            <Button
              id="add-media-btn"
              size="sm"
              onClick={() => setPickerOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Media
            </Button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); updateFilter(); }}
              placeholder="Search by filename…"
              className="pl-9 bg-card border-border text-foreground"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "image", "video"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setFilter(t); updateFilter(); }}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  filter === t
                    ? "bg-blue-600 border-blue-500 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "all" ? "All" : t === "image" ? "Images" : "Videos"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="flex-1">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
              <ImageIcon className="w-12 h-12 opacity-40" />
              <p className="text-sm">No media found</p>
              <Button
                size="sm"
                onClick={() => setPickerOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 mt-2"
              >
                <Plus className="w-4 h-4" />
                Upload your first file
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
              {files.map((file) => {
                const isImage = file.fileType === "image";
                return (
                  <div
                    key={file.fileId}
                    className="group relative rounded-xl border border-border bg-card overflow-hidden hover:border-slate-600 transition-colors"
                  >
                    <div className="aspect-square relative bg-card">
                      {isImage ? (
                        <Image
                          src={`${file.url}${file.url.includes("?") ? "&" : "?"}tr=w-400`}
                          alt={file.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, 20vw"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <Film className="w-8 h-8" />
                          <span className="text-[10px] uppercase tracking-wider">Video</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(file)}
                        disabled={deletingId === file.fileId || file.products.length > 0}
                        title={
                          file.products.length > 0
                            ? `Used by ${file.products.map((p) => p.name).join(", ")}`
                            : "Delete permanently"
                        }
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                      >
                        {deletingId === file.fileId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="p-2.5 space-y-1">
                      <p className="text-xs text-foreground truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatSize(file.size)}
                        {file.width && file.height ? ` · ${file.width}×${file.height}` : ""}
                      </p>
                      {file.products.length > 0 ? (
                        <div className="space-y-0.5">
                          {file.products.map((p) => (
                            <p key={p.id} className="text-[10px] text-sky-400 truncate">
                              {p.isPrimary ? "★ " : ""}
                              {p.name}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-amber-500/70">Unlinked</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {!loading && files.length > 0 && totalPages > 1 && (
          <div className="mt-auto pt-6 border-t border-border">
            <URLPagination currentPage={page} totalPages={totalPages} />
          </div>
        )}
      </div>

      {/* ── Media Picker Dialog ── */}
      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        defaultTab="upload"
        multiple={true}
        allowedTypes="all"
        onSelect={handlePickerSelect}
      />
    </div>
  );
}
