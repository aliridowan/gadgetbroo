"use client";

/**
 * MediaPickerDialog — Universal Polymorphic Media Picker (v2: Staged Upload)
 *
 * Section 4 UX Architecture (per implementation instructions):
 *   - Dropping/selecting files STAGES them locally (no immediate upload)
 *   - Each staged card has an X button to remove before committing
 *   - Explicit "Upload Media (N)" button in Upload tab triggers actual upload
 *   - "Select Media (N)" button in Library tab confirms selection
 *   - Library selected items show checkmark → hover shows X for quick deselect
 *   - Selected items summary strip at bottom of library for quick unselection
 *
 * This file is presentational only — all data/network logic lives in
 * useMediaLibrary (browsing/searching/selecting) and useMediaUpload
 * (staging + the hash → dedup → upload → register pipeline). See those
 * files to change how fetching or uploading works; change this file to
 * change how it looks.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Search,
  X,
  Check,
  Upload,
  ImageIcon,
  Film,
  Loader2,
  LibrarySquare,
  CloudUpload,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  MediaFileRecord,
  MediaPickerDialogProps,
  TabId,
  TypeFilter,
} from "./media.types";
import { formatSize } from "./media-utils";
import { useMediaLibrary } from "./useMediaLibrary";
import { useMediaUpload } from "./useMediaUpload";

export type { MediaFileRecord } from "./media.types";

/* ─── Component ──────────────────────────────────────────────────────── */
export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
  multiple = false,
  allowedTypes = "all",
  defaultTab = "library",
}: MediaPickerDialogProps) {
  /* ── Tab ── */
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  const library = useMediaLibrary({ open, activeTab, allowedTypes });

  /* Called by useMediaUpload once files finish uploading (or are reused as
     duplicates) — refresh the library, pre-select the new files, and hop
     over to the Library tab so the user sees what just landed. */
  const handleUploaded = useCallback(
    async (newlyUploaded: MediaFileRecord[]) => {
      await library.fetchLibrary(library.search, library.typeFilter, 1);
      library.setSelected(newlyUploaded);
      setActiveTab("library");
    },
    // Intentionally depend on the individual stable fields we use, not the
    // whole `library` object — that object literal is recreated every
    // render, which would make this (and everything downstream of it)
    // re-create on every render for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [library.fetchLibrary, library.search, library.typeFilter, library.setSelected]
  );

  const upload = useMediaUpload({ allowedTypes, onUploaded: handleUploaded });

  /* ── Drag state ── */
  const [dragging, setDragging] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Reset on open/close ── */
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(defaultTab);
      library.resetForOpen();
      upload.resetUploadState();
    }
    // Cleanup object URLs when dialog closes
    if (!open) {
      upload.resetUploadState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultTab]);

  /* ── Confirm library selection ── */
  const confirmSelection = () => {
    if (library.selected.length === 0) return;
    onSelect(multiple ? library.selected : library.selected[0]);
    onOpenChange(false);
  };

  /* ── Drag & drop handlers — call handleStageFiles ── */
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) upload.handleStageFiles(dropped);
  };

  /* ── Type filter buttons ── */
  const typeOptions: { label: string; value: TypeFilter }[] = [
    { label: "All", value: "all" },
    { label: "Images", value: "image" },
    { label: "Videos", value: "video" },
  ];
  const availableFilters =
    allowedTypes === "all"
      ? typeOptions
      : typeOptions.filter((o) => o.value === "all" || o.value === allowedTypes);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          max-w-5xl w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col
          bg-[#0d1117] border border-slate-800/80 shadow-2xl rounded-2xl
        "
      >
        {/* ── Header + Tabs ── */}
        <DialogHeader className="px-6 pt-5 pb-0 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-white">
              Media Library
            </DialogTitle>
          </div>

          <div className="flex gap-1 mt-4 border-b border-slate-800">
            {(["library", "upload"] as TabId[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
              >
                {tab === "library" ? <LibrarySquare size={14} /> : <CloudUpload size={14} />}
                {tab === "library" ? "Library" : "Upload New"}
                {tab === "upload" && upload.stagedFiles.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-black">
                    {upload.stagedFiles.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ═══════════ LIBRARY TAB ═══════════ */}
          {activeTab === "library" && (
            <div className="flex flex-col h-full">
              {/* Controls */}
              <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 border-b border-slate-800/60 shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  <Input
                    value={library.search}
                    onChange={(e) => library.setSearch(e.target.value)}
                    placeholder="Search by filename…"
                    className="pl-9 bg-[#161b22] border-slate-700 text-slate-200 placeholder:text-slate-600 h-9 text-sm"
                  />
                </div>
                <div className="flex gap-1.5">
                  {availableFilters.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => library.setTypeFilter(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${library.typeFilter === opt.value
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {library.libLoading ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-sm">Loading library…</span>
                  </div>
                ) : library.visibleFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
                    <ImageIcon className="w-10 h-10 opacity-40" />
                    <span className="text-sm">
                      {library.search ? "No files match your search" : "No media in library yet"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 border-slate-700 text-slate-300"
                      onClick={() => setActiveTab("upload")}
                    >
                      Upload your first file
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8 gap-3">
                    {library.visibleFiles.map((file) => {
                      const sel = library.isSelected(file);
                      const isImg = file.fileType === "image";
                      return (
                        /* STEP 4.4: Selection toggles; hover on selected shows X indicator */

                        <button
                          key={file.fileId}
                          type="button"
                          onClick={() => library.toggleSelect(file, multiple)}
                          className={`
                            group relative rounded-xl overflow-hidden border-2 transition-all duration-150
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                            ${sel
                              ? "border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.3)]"
                              : "border-slate-800 hover:border-slate-600"
                            }
                          `}
                        >
                          <div className="aspect-square relative bg-slate-900">
                            {isImg ? (
                              <Image
                                src={file.url}
                                alt={file.name}
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 50vw, 25vw"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500">
                                <Film className="w-8 h-8" />
                                <span className="text-[10px] uppercase tracking-wider">Video</span>
                              </div>
                            )}

                            {/* Selected badge — checkmark normally, X on hover for quick deselect */}
                            {sel && (
                              <div className="absolute inset-0 bg-blue-500/10">
                                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-md group-hover:hidden">
                                  <Check size={11} className="text-white" />
                                </span>
                                {/* X on hover — communicates "click to deselect" */}
                                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-500 hidden group-hover:flex items-center justify-center shadow-md">
                                  <X size={11} className="text-white" />
                                </span>
                              </div>
                            )}
                            {!sel && (
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                            )}
                          </div>

                          <div className="p-2 text-left bg-[#0d1117]">
                            <p className="text-xs text-slate-300 truncate" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-[10px] text-slate-600 mt-0.5">
                              {formatSize(file.size)}
                              {file.width && file.height ? ` · ${file.width}×${file.height}` : ""}
                            </p>
                            {file.products && file.products.length > 0 && (
                              <p className="text-[10px] text-sky-500/80 truncate mt-0.5">
                                {file.products.map((p) => p.name).join(", ")}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Pagination Controls */}
                {!library.libLoading && library.visibleFiles.length > 0 && library.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6 pb-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={library.page <= 1 || library.libLoading}
                      onClick={() => library.setPage((p) => p - 1)}
                      className="border-slate-700 text-slate-300 h-8"
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-slate-400 mx-2">
                      Page {library.page} of {library.totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={library.page >= library.totalPages || library.libLoading}
                      onClick={() => library.setPage((p) => p + 1)}
                      className="border-slate-700 text-slate-300 h-8"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>

              {/* STEP 4.4: Selected items summary strip — quick unselect without scrolling */}
              {library.selected.length > 0 && (
                <div className="shrink-0 px-6 py-3 border-t border-slate-800/60 bg-[#0a0d12]">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider shrink-0">
                      Selected ({library.selected.length}):
                    </span>
                    <div className="flex gap-2 overflow-x-auto pb-1 flex-1 min-w-0">
                      {library.selected.map((f) => (
                        <div
                          key={f.fileId}
                          className="group relative shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-blue-500/60 bg-slate-900"
                        >
                          {f.fileType === "image" ? (
                            <Image
                              src={f.url}
                              alt={f.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Film size={14} className="text-slate-500" />
                            </div>
                          )}
                          {/* Quick unselect button on the thumbnail */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              library.removeFromSelected(f.fileId);
                            }}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            title={`Unselect ${f.name}`}
                          >
                            <X size={12} className="text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════ UPLOAD TAB ═══════════ */}
          {activeTab === "upload" && (
            <div className="px-6 py-5 space-y-5">
              {/* Dropzone — calls handleStageFiles, NOT processFiles */}
              <div
                ref={dropRef}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !upload.uploading && fileInputRef.current?.click()}
                className={`
                  relative flex flex-col items-center justify-center gap-4
                  border-2 border-dashed rounded-2xl p-10 cursor-pointer
                  transition-all duration-200 select-none
                  ${dragging
                    ? "border-blue-500 bg-blue-500/5 scale-[1.01]"
                    : "border-slate-700 hover:border-slate-500 hover:bg-slate-800/30"
                  }
                  ${upload.uploading ? "pointer-events-none opacity-60" : ""}
                `}
              >
                <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-300">
                    {dragging ? "Drop files here" : "Drag & drop files here"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    or click to browse ·{" "}
                    {allowedTypes === "video"
                      ? "videos up to 100MB"
                      : allowedTypes === "image"
                        ? "images up to 10MB"
                        : "images (10MB) or videos (100MB)"}
                  </p>
                  {upload.stagedFiles.length > 0 && (
                    <p className="mt-2 text-xs text-amber-400 font-medium">
                      {upload.stagedFiles.length} file{upload.stagedFiles.length > 1 ? "s" : ""} staged — click &quot;Upload Media&quot; below to commit
                    </p>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={
                    allowedTypes === "image"
                      ? "image/*"
                      : allowedTypes === "video"
                        ? "video/*"
                        : "image/*,video/*"
                  }
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      upload.handleStageFiles(Array.from(e.target.files));
                      e.target.value = "";
                    }
                  }}
                />
              </div>

              {/* STEP 4.2: Staged preview grid with X removal buttons */}
              {upload.stagedFiles.length > 0 && !upload.uploading && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Staged — Review before uploading
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8 gap-3">
                    {upload.stagedFiles.map((item) => (
                      <div
                        key={item.id}
                        className="group relative rounded-xl overflow-hidden border border-slate-700 bg-[#161b22]"
                      >
                        {/* Preview */}
                        <div className="aspect-square relative bg-slate-900">
                          {item.mediaType === "image" ? (
                            <Image
                              src={item.previewUrl}
                              alt={item.file.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 50vw, 25vw"
                            />
                          ) : (
                            <video
                              src={item.previewUrl}
                              muted
                              className="w-full h-full object-cover bg-black"
                            />
                          )}

                          {/* STEP 4.2: Mandatory X removal button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              upload.removeStagedFile(item.id);
                            }}
                            className="
                              absolute top-2 right-2 z-10
                              p-1.5 rounded-full
                              bg-black/70 text-gray-300
                              hover:text-red-400 hover:bg-black
                              border border-slate-700
                              transition-all shadow-md
                              group-hover:scale-105
                            "
                            title="Remove file from upload queue"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        {/* Caption */}
                        <div className="px-2 py-1.5 bg-[#0d1117]/90">
                          <p className="text-[11px] text-slate-300 truncate" title={item.file.name}>
                            {item.file.name}
                          </p>
                          <p className="text-[10px] text-slate-600">
                            {formatSize(item.file.size)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload queue progress (during actual upload) */}
              {upload.uploadQueue.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Upload Progress
                  </p>
                  <div className="space-y-1.5">
                    {upload.uploadQueue.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#161b22] border border-slate-800"
                      >
                        <div className="shrink-0 w-6 h-6 flex items-center justify-center">
                          {item.status === "done" || item.status === "duplicate" ? (
                            <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                              <Check size={11} className="text-emerald-400" />
                            </span>
                          ) : item.status === "error" ? (
                            <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                              <AlertCircle size={11} className="text-red-400" />
                            </span>
                          ) : (
                            <Loader2 size={14} className="text-blue-400 animate-spin" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-300 truncate">{item.name}</p>
                          <p className={`text-[10px] mt-0.5 ${item.status === "done" ? "text-emerald-400"
                              : item.status === "duplicate" ? "text-amber-400"
                                : item.status === "error" ? "text-red-400"
                                  : "text-slate-500"
                            }`}>
                            {item.status === "hashing" && "Computing SHA-256 hash…"}
                            {item.status === "checking" && "Checking for duplicates…"}
                            {item.status === "uploading" && "Uploading to Cloud Storage…"}
                            {item.status === "done" && "Uploaded & indexed in database"}
                            {item.status === "duplicate" && "Duplicate — reusing existing asset"}
                            {item.status === "error" && (item.error ?? "Upload failed")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══════════ FOOTER — STEP 4.3: Tab-specific action buttons ═══════════ */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-800/60 bg-[#0d1117] flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            {activeTab === "upload"
              ? upload.stagedFiles.length > 0
                ? `${upload.stagedFiles.length} file${upload.stagedFiles.length > 1 ? "s" : ""} staged, awaiting upload`
                : "Drop files above to stage them"
              : library.selected.length > 0
                ? `${library.selected.length} file${library.selected.length > 1 ? "s" : ""} selected`
                : "Click thumbnails to select"
            }
          </p>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancel
            </Button>

            {/* STEP 4.3: Upload tab shows "Upload Media" — Library tab shows "Select Media" */}
            {activeTab === "upload" ? (
              <Button
                size="sm"
                onClick={() => upload.processFiles(upload.stagedFiles.map((s) => s.file))}
                disabled={upload.stagedFiles.length === 0 || upload.uploading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 min-w-[140px] gap-2"
              >
                {upload.uploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <CloudUpload size={14} />
                    Upload Media
                    {upload.stagedFiles.length > 0 && ` (${upload.stagedFiles.length})`}
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={confirmSelection}
                disabled={library.selected.length === 0}
                className="bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 min-w-[140px]"
              >
                Select Media
                {library.selected.length > 0 && ` (${library.selected.length})`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
