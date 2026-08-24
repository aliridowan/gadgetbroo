/**
 * Shared types for the Media Picker — library records, staged/upload-queue
 * items, and the dialog's public props.
 */

export type MediaFileRecord = {
  fileId: string;
  name: string;
  url: string;
  filePath: string;
  fileType: string;
  mimeType?: string | null;
  size: number;
  width?: number | null;
  height?: number | null;
  hash?: string | null;
  createdAt?: string | Date | null;
  products?: { id: string; name: string; slug: string; isPrimary: boolean }[];
};

/** An item staged locally before any network call is made */
export interface StagedFile {
  /** Unique ID for React key */
  id: string;
  file: File;
  /** Object URL for browser-side preview — MUST be revoked on removal */
  previewUrl: string;
  mediaType: "image" | "video";
}

/** An item in the active upload queue (after "Upload Media" is clicked) */
export type UploadingFile = {
  name: string;
  status: "hashing" | "checking" | "uploading" | "done" | "error" | "duplicate";
  record?: MediaFileRecord;
  error?: string;
};

export interface MediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (selected: MediaFileRecord | MediaFileRecord[]) => void;
  multiple?: boolean;
  allowedTypes?: "all" | "image" | "video";
  defaultTab?: "library" | "upload";
}

export type TabId = "library" | "upload";
export type TypeFilter = "all" | "image" | "video";
