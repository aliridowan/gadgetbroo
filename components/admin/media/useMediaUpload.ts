"use client";

/**
 * useMediaUpload — staging files locally and running the actual upload
 * (hash → dedup-check → server-side Garage upload → DB register).
 * Pure upload concern: browsing/selecting existing library items lives in
 * useMediaLibrary.
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { MediaFileRecord, StagedFile, UploadingFile } from "./media.types";
import { sha256Hex } from "./media-utils";

interface UseMediaUploadArgs {
  allowedTypes: "all" | "image" | "video";
  /** Called with every file that ended up in the library (new upload or reused duplicate). */
  onUploaded: (newlyUploaded: MediaFileRecord[]) => void;
}

export function useMediaUpload({ allowedTypes, onUploaded }: UseMediaUploadArgs) {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [uploadQueue, setUploadQueue] = useState<UploadingFile[]>([]);
  const [uploading, setUploading] = useState(false);

  /* ────────────────────────────────────────────────────────────────
     STEP 4.1: Staging — intercept dropped/selected files locally.
     No network call here. Just validate + createObjectURL + append.
  ────────────────────────────────────────────────────────────────── */
  const handleStageFiles = useCallback(
    (rawFiles: File[]) => {
      setStagedFiles((prevStaged) => {
        const valid: StagedFile[] = [];

        for (const file of rawFiles) {
          const isImage = file.type.startsWith("image/");
          const isVideo = file.type.startsWith("video/");

          if (allowedTypes === "image" && !isImage) {
            toast.error(`${file.name}: only images are allowed`);
            continue;
          }
          if (allowedTypes === "video" && !isVideo) {
            toast.error(`${file.name}: only videos are allowed`);
            continue;
          }
          if (!isImage && !isVideo) {
            toast.error(`${file.name}: only images and videos are supported`);
            continue;
          }

          const maxMB = isVideo ? 100 : 10;
          if (file.size > maxMB * 1024 * 1024) {
            toast.error(`${file.name}: too large (max ${maxMB}MB)`);
            continue;
          }

          // Skip exact duplicates already staged (same name + size) — matches
          // original behavior: only checked against files staged *before* this
          // batch, not against other files within the same drop/select batch.
          const alreadyStaged = prevStaged.some(
            (s) => s.file.name === file.name && s.file.size === file.size
          );
          if (alreadyStaged) {
            toast.info(`${file.name}: already in staging queue`);
            continue;
          }

          valid.push({
            id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
            file,
            previewUrl: URL.createObjectURL(file),
            mediaType: isVideo ? "video" : "image",
          });
        }

        if (valid.length > 0) {
          toast.success(`${valid.length} file${valid.length > 1 ? "s" : ""} added to staging queue`);
        }

        return valid.length > 0 ? [...prevStaged, ...valid] : prevStaged;
      });
    },
    [allowedTypes]
  );

  /* STEP 4.2: Remove a staged file — revoke its Object URL */
  const removeStagedFile = useCallback((id: string) => {
    setStagedFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  /* ────────────────────────────────────────────────────────────────
     STEP 4.3: Actual upload — only called when "Upload Media" is clicked.
     Pulls from stagedFiles, runs hash → dedup → server-side Garage upload → DB register.
  ────────────────────────────────────────────────────────────────── */
  const processFiles = useCallback(
    async (filesToUpload: File[]) => {
      if (filesToUpload.length === 0) return;

      const initialQueue: UploadingFile[] = filesToUpload.map((f) => ({
        name: f.name,
        status: "hashing",
      }));
      setUploadQueue(initialQueue);
      setUploading(true);

      const newlyUploaded: MediaFileRecord[] = [];

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const updateItem = (patch: Partial<UploadingFile>) =>
          setUploadQueue((q) =>
            q.map((item, idx) => (idx === i ? { ...item, ...patch } : item))
          );

        try {
          // 1. SHA-256 hash in browser
          updateItem({ status: "hashing" });
          const hashHex = await sha256Hex(file);

          // 2. Check for duplicate in Postgres
          updateItem({ status: "checking" });
          const checkRes = await fetch("/api/media/check-duplicate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hash: hashHex }),
          });
          const checkData = await checkRes.json();

          if (checkData.duplicate) {
            toast.success(`"${file.name}" already exists — reusing library asset.`);
            updateItem({ status: "duplicate", record: checkData.file });
            newlyUploaded.push(checkData.file);
            continue;
          }

          // 3. Upload the file to Garage via our own server (no browser CORS involved)
          updateItem({ status: "uploading" });
          const mediaType = file.type.startsWith("video/") ? "video" : "image";
          const uploadForm = new FormData();
          uploadForm.append("file", file);
          const uploadRes = await fetch("/api/media/upload", {
            method: "POST",
            body: uploadForm,
          });
          const uploadData = await uploadRes.json();
          if (!uploadRes.ok) throw new Error(uploadData.error || "Cloud upload failed");

          // 4. Register in PostgreSQL with hash
          const regRes = await fetch("/api/media", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: uploadData.url,
              fileId: uploadData.fileKey,
              name: file.name,
              filePath: uploadData.fileKey,
              fileType: mediaType,
              mimeType: file.type,
              size: file.size,
              width: null,
              height: null,
              hash: hashHex,
            }),
          });
          const regData = await regRes.json();
          if (!regRes.ok) throw new Error(regData.error || "DB registration failed");

          updateItem({ status: "done", record: regData.file });
          newlyUploaded.push(regData.file);
          toast.success(`"${file.name}" uploaded & indexed!`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          updateItem({ status: "error", error: msg });
          toast.error(`"${file.name}": ${msg}`);
        }
      }

      setUploading(false);

      // Clean up: revoke object URLs and clear staged queue
      setStagedFiles((prev) => {
        prev.forEach((s) => URL.revokeObjectURL(s.previewUrl));
        return [];
      });

      if (newlyUploaded.length > 0) {
        onUploaded(newlyUploaded);
      }
    },
    [onUploaded]
  );

  /** Reset upload state — used both when the dialog opens and when it closes. */
  const resetUploadState = useCallback(() => {
    setStagedFiles((prev) => {
      prev.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      return [];
    });
    setUploadQueue([]);
  }, []);

  return {
    stagedFiles,
    uploadQueue,
    uploading,
    handleStageFiles,
    removeStagedFile,
    processFiles,
    resetUploadState,
  };
}
