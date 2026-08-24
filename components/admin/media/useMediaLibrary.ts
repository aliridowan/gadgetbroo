"use client";

/**
 * useMediaLibrary — browsing/searching/selecting media already indexed in
 * Postgres. Pure data concern: no upload logic lives here (see useMediaUpload).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { MediaFileRecord, TabId, TypeFilter } from "./media.types";

interface UseMediaLibraryArgs {
  open: boolean;
  activeTab: TabId;
  allowedTypes: "all" | "image" | "video";
}

export function useMediaLibrary({ open, activeTab, allowedTypes }: UseMediaLibraryArgs) {
  const [files, setFiles] = useState<MediaFileRecord[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(
    allowedTypes === "all" ? "all" : allowedTypes
  );
  const [selected, setSelected] = useState<MediaFileRecord[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  /* ── Fetch library ── */
  const fetchLibrary = useCallback(async (q: string, t: TypeFilter, p: number) => {
    setLibLoading(true);
    try {
      const params = new URLSearchParams({ limit: "16", page: p.toString() });
      if (q) params.set("search", q);
      if (t !== "all") params.set("type", t);
      const res = await fetch(`/api/media?${params}`);
      if (!res.ok) throw new Error("Failed to load media");
      const data = await res.json();
      setFiles(data.files ?? []);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast.error("Failed to load media library");
    } finally {
      setLibLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || activeTab !== "library") return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchLibrary(search, typeFilter, page), 250);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [open, activeTab, search, typeFilter, page, fetchLibrary]);

  /* ── Selection ── */
  const toggleSelect = useCallback((file: MediaFileRecord, multiple: boolean) => {
    setSelected((prev) => {
      const isAlreadySelected = prev.some((f) => f.fileId === file.fileId);
      if (!multiple) return isAlreadySelected ? [] : [file];
      return isAlreadySelected
        ? prev.filter((f) => f.fileId !== file.fileId)
        : [...prev, file];
    });
  }, []);

  const removeFromSelected = useCallback((fileId: string) => {
    setSelected((prev) => prev.filter((f) => f.fileId !== fileId));
  }, []);

  const isSelected = useCallback(
    (file: MediaFileRecord) => selected.some((f) => f.fileId === file.fileId),
    [selected]
  );

  /* ── Filtered visible files ── */
  const visibleFiles = useMemo(() => {
    if (allowedTypes === "all") return files;
    return files.filter((f) => f.fileType === allowedTypes);
  }, [files, allowedTypes]);

  /** Reset browsing/selection state when the dialog opens. */
  const resetForOpen = useCallback(() => {
    setSelected([]);
    setSearch("");
  }, []);

  return {
    files,
    visibleFiles,
    libLoading,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    selected,
    setSelected,
    page,
    setPage,
    totalPages,
    fetchLibrary,
    toggleSelect,
    removeFromSelected,
    isSelected,
    resetForOpen,
  };
}
