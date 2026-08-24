"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, Plus, Trash2, Edit, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaPickerDialog, MediaFileRecord } from "@/components/admin/media/MediaPickerDialog";

type SiteMedia = {
  id: string;
  title: string;
  url: string;
  fileId: string;
  placement: "HERO_SLIDER" | "PROMOTIONAL_BANNER" | "CATEGORY_BANNER";
  linkUrl: string | null;
  isActive: boolean;
  sortOrder: number;
};

export default function SiteMediaClient({
  initialBanners,
}: {
  initialBanners: SiteMedia[];
}) {
  const [banners, setBanners] = useState<SiteMedia[]>(initialBanners);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New Banner Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPlacement, setNewPlacement] = useState<SiteMedia["placement"]>("HERO_SLIDER");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<MediaFileRecord | null>(null);

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/site-media");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBanners(data.banners);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load banners");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedFile || !newTitle) {
      toast.error("Title and Image are required.");
      return;
    }

    const payload = {
      title: newTitle,
      url: selectedFile.url,
      fileId: selectedFile.fileId,
      placement: newPlacement,
      linkUrl: newLinkUrl || null,
      isActive: true,
      ...(editingId ? {} : { sortOrder: banners.length }),
    };

    try {
      const url = editingId ? `/api/site-media/${editingId}` : "/api/site-media";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed to ${editingId ? "update" : "create"} banner`);
      toast.success(`Banner ${editingId ? "updated" : "created"}!`);

      setShowAddForm(false);
      setEditingId(null);
      setNewTitle("");
      setNewLinkUrl("");
      setSelectedFile(null);
      fetchBanners();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error saving banner");
    }
  };

  const openEditForm = (banner: SiteMedia) => {
    setEditingId(banner.id);
    setNewTitle(banner.title);
    setNewPlacement(banner.placement);
    setNewLinkUrl(banner.linkUrl || "");
    // Create a mock selectedFile object to satisfy the form state
    setSelectedFile({ fileId: banner.fileId, url: banner.url, name: banner.title, fileType: "image" } as MediaFileRecord);
    setShowAddForm(true);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this banner?")) return;
    try {
      const res = await fetch(`/api/site-media/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Banner deleted");
      setBanners((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      toast.error("Error deleting banner");
    }
  };

  const handleToggleActive = async (banner: SiteMedia) => {
    try {
      const res = await fetch(`/api/site-media/${banner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !banner.isActive }),
      });
      if (!res.ok) throw new Error("Update failed");
      fetchBanners();
      toast.success(`Banner ${banner.isActive ? "hidden" : "activated"}`);
    } catch (e) {
      toast.error("Error updating banner");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Homepage Banners</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage storefront hero sliders and promotional graphics.</p>
          </div>
          <Button
            onClick={() => {
              setEditingId(null);
              setNewTitle("");
              setNewLinkUrl("");
              setSelectedFile(null);
              setShowAddForm(true);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <Plus size={16} /> Add Banner
          </Button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">{editingId ? "Edit Banner" : "Create New Banner"}</h2>
              <button onClick={() => { setShowAddForm(false); setEditingId(null); }} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Title</label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="bg-background border-border mt-1 text-foreground"
                    placeholder="e.g. Summer Sale 2026"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Placement</label>
                  <select
                    value={newPlacement}
                    onChange={(e) => setNewPlacement(e.target.value as SiteMedia["placement"])}
                    className="w-full bg-background border border-border text-foreground rounded-md p-2.5 mt-1 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="HERO_SLIDER">Hero Slider (Main)</option>
                    <option value="PROMOTIONAL_BANNER">Promotional Banner (Middle)</option>
                    <option value="CATEGORY_BANNER">Category Banner</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Link URL (Optional)</label>
                  <Input
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    className="bg-background border-border mt-1 text-foreground"
                    placeholder="/store?category=laptops"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Banner Image</label>
                <div
                  onClick={() => setPickerOpen(true)}
                  className="h-40 border-2 border-dashed border-border rounded-xl flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-muted transition-all overflow-hidden relative bg-background"
                >
                  {selectedFile ? (
                    <Image src={`${selectedFile.url}?tr=w-600`} alt="Selected" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-muted-foreground">
                      <ImageIcon size={24} className="mb-2" />
                      <span className="text-sm">Click to select from Library</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-foreground px-8">
                {editingId ? "Update Banner" : "Save Banner"}
              </Button>
            </div>
          </div>
        )}

        {/* Banners List */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : banners.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground bg-card rounded-2xl border border-border">
            <ImageIcon className="w-12 h-12 opacity-40 mx-auto mb-4" />
            <p>No banners created yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {banners.map((banner) => (
              <div key={banner.id} className="bg-card border border-border rounded-xl overflow-hidden group">
                <div className="aspect-video relative bg-card border-b border-border">
                  <Image src={`${banner.url}?tr=w-600`} alt={banner.title} fill sizes="(max-width: 768px) 100vw, 33vw" className={`object-cover ${!banner.isActive ? "opacity-40 grayscale" : ""}`} />
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleToggleActive(banner)}
                      className={`px-2 py-1 text-[10px] font-bold rounded bg-black/80 ${banner.isActive ? "text-amber-400" : "text-emerald-400"}`}
                    >
                      {banner.isActive ? "DISABLE" : "ENABLE"}
                    </button>
                    <button onClick={() => openEditForm(banner)} className="p-1.5 rounded bg-black/80 text-blue-400 hover:bg-blue-500 hover:text-foreground transition-colors">
                      <Edit size={14} />
                    </button>
                    <button onClick={() => handleDelete(banner.id)} className="p-1.5 rounded bg-black/80 text-destructive hover:bg-red-500 hover:text-foreground transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-foreground truncate pr-2">{banner.title}</h3>
                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded shrink-0">{banner.placement.replace("_", " ")}</span>
                  </div>
                  <p className="text-xs text-sky-400 truncate">{banner.linkUrl || "No link"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        allowedTypes="image"
        multiple={false}
        onSelect={(file) => setSelectedFile(Array.isArray(file) ? file[0] : file)}
      />
    </div>
  );
}
