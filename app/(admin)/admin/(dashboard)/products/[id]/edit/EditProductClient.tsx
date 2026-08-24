"use client";

import { useState } from "react";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Star, Images } from "lucide-react";
import Image from "next/image";
import { MediaPickerDialog, type MediaFileRecord } from "@/components/admin/media/MediaPickerDialog";
import { ProductPreviewCard } from "@/components/admin/ProductPreviewCard";
import { updateProductSchema, UpdateProductValues } from "@/zodSchemas/productSchema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/loading-button";
import { Switch } from "@/components/ui/switch";
import TiptapEditor from "@/components/admin/TiptapEditor";
import { DynamicOptionBuilder, type ProductOption } from "@/components/admin/DynamicOptionBuilder";
import { TagsInput } from "@/components/admin/TagsInput";
import { generateCartesianCombinations } from "../../productFormUtils";

type Category = { id: string; name: string; slug: string };

type UploadedMedia = {
  id?: string;
  url: string;
  fileId: string;
  name: string;
  isPrimary: boolean;
  mediaType: "image" | "video";
};

export default function EditProductClient({
  productId,
  initialCategories,
  initialValues,
  initialMedia,
}: {
  productId: string;
  initialCategories: Category[];
  initialValues: UpdateProductValues;
  initialMedia: UploadedMedia[];
}) {
  const router = useRouter();

  const [categories] = useState<Category[]>(initialCategories);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>(initialMedia);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<UpdateProductValues>({
    resolver: zodResolver(updateProductSchema) as Resolver<UpdateProductValues>,
    defaultValues: initialValues,
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "variants",
  });

  const handleGenerateVariants = (options: ProductOption[]) => {
    const combs = generateCartesianCombinations(options);
    if (combs.length === 0) {
      replace([{ name: "Default", sku: "", price: 0, stock: 0, attributes: {}, isActive: true }]);
      return;
    }

    const price = form.getValues("variants.0.price") || 0;
    const stock = form.getValues("variants.0.stock") || 0;

    const newVariants = combs.map(comb => ({
      name: Object.values(comb).join(" / "),
      sku: "",
      price,
      stock,
      attributes: comb,
      isActive: true,
    }));

    replace(newVariants);
  };

  const handleMediaSelect = async (selected: MediaFileRecord | MediaFileRecord[]) => {
    const incoming = Array.isArray(selected) ? selected : [selected];
    const hasImage = uploadedMedia.some((m) => m.mediaType === "image");

    for (let i = 0; i < incoming.length; i++) {
      const f = incoming[i];
      if (uploadedMedia.some((p) => p.fileId === f.fileId)) continue;

      const mediaType = f.fileType === "video" ? "video" : "image";
      const isPrimary = !hasImage && mediaType === "image" && i === 0;

      try {
        const res = await fetch(`/api/products/${productId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: f.url, fileId: f.fileId, name: f.name, isPrimary }),
        });
        const data = await res.json();
        if (res.ok) {
          setUploadedMedia((prev) => [...prev, { id: data.image.id, url: f.url, fileId: f.fileId, name: f.name, mediaType, isPrimary }]);
        }
      } catch {
        toast.error("Failed to add image");
      }
    }
  };

  const setPrimaryImage = async (index: number) => {
    const item = uploadedMedia[index];
    if (!item.id) return;

    try {
      await fetch(`/api/products/${productId}/images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: item.id }),
      });

      setUploadedMedia((prev) =>
        prev.map((m, i) => ({ ...m, isPrimary: m.mediaType === "image" && i === index }))
      );
    } catch {
      toast.error("Failed to update primary image");
    }
  };

  const removeMedia = async (index: number) => {
    const item = uploadedMedia[index];
    if (item.id) {
      try {
        await fetch(`/api/products/${productId}/images`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageId: item.id }),
        });
      } catch {
        toast.error("Failed to remove image");
        return;
      }
    }

    setUploadedMedia((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (item.isPrimary && next.some(m => m.mediaType === "image")) {
        const firstImg = next.findIndex((m) => m.mediaType === "image");
        if (firstImg >= 0 && next[firstImg].id) {
           fetch(`/api/products/${productId}/images`, {
             method: "PATCH",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ imageId: next[firstImg].id }),
           });
           next[firstImg] = { ...next[firstImg], isPrimary: true };
        }
      }
      return next;
    });
  };

  async function onSubmit(values: UpdateProductValues) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to update product");
        return;
      }

      toast.success("Product updated successfully");
      router.push("/admin/products");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const liveName = form.watch("name");
  const liveBrand = form.watch("brand");
  const liveVariants = form.watch("variants");
  const livePrice = liveVariants?.[0]?.price;

  return (
    <div className="max-w-[1600px] mx-auto pb-6 flex flex-col xl:flex-row gap-8 items-start">
      {/* ── Left Content (Form) ──────────────────────── */}
      <div className="flex-1 w-full space-y-8 min-w-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Edit Product</h1>
          <p className="text-sm text-gray-400 mt-1">Update your product details and variants</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <section className="bg-card/80 border border-border rounded-xl p-6 space-y-5">
              <h2 className="text-base font-semibold text-foreground">Basic Information</h2>

              <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Product Name</FormLabel><FormControl>
                    <Input placeholder="Apple iPhone 15 Pro 256GB" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />

              <FormField control={form.control} name="slug" render={({ field }) => (
                  <FormItem><FormLabel>Slug</FormLabel><FormControl>
                    <Input placeholder="apple-iphone-15-pro-256gb" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="brand" render={({ field }) => (
                    <FormItem><FormLabel>Brand</FormLabel><FormControl>
                      <Input placeholder="Apple" {...field} />
                    </FormControl><FormMessage /></FormItem>
                  )} />

                <FormField control={form.control} name="categoryId" render={({ field }) => (
                    <FormItem><FormLabel>Category</FormLabel><FormControl>
                      <select className="w-full bg-background border border-border text-foreground text-sm rounded-md px-3 py-2 outline-none focus:border-slate-500" {...field}>
                        <option value="">Select category</option>
                        {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                      </select>
                    </FormControl><FormMessage /></FormItem>
                  )} />
              </div>

              <FormField control={form.control} name="tags" render={({ field }) => (
                  <FormItem><FormLabel>SEO Tags</FormLabel><FormControl>
                    <TagsInput value={field.value || []} onChange={field.onChange} placeholder="e.g. gaming mouse, wireless, logitech (Press Enter)" />
                  </FormControl><FormMessage /></FormItem>
                )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Description</FormLabel><FormControl>
                    <TiptapEditor content={field.value || ""} onChange={field.onChange} />
                  </FormControl><FormMessage /></FormItem>
                )} />

              <div className="flex gap-8">
                <FormField control={form.control} name="isActive" render={({ field }) => (
                    <FormItem className="flex items-center gap-3"><FormLabel>Active</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                  )} />
                <FormField control={form.control} name="isFeatured" render={({ field }) => (
                    <FormItem className="flex items-center gap-3"><FormLabel>Featured</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                  )} />
              </div>
            </section>

            {/* ── Product Options ───────────────────────────── */}
            <section className="bg-card/80 border border-border rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-foreground">Product Options</h2>
                <p className="text-xs text-gray-400 mt-0.5">Dynamically add options like Color or Size to auto-generate variants.</p>
              </div>

              <FormField control={form.control} name="options" render={({ field }) => (
                <DynamicOptionBuilder
                  options={field.value || []}
                  onOptionsChange={field.onChange}
                  onGenerateVariants={handleGenerateVariants}
                />
              )} />
            </section>

            <section className="bg-card/80 border border-border rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Variants</h2>
                </div>
                <Button type="button" onClick={() => append({ name: "", sku: "", price: 0, stock: 0, isActive: true, attributes: {} })} className="bg-secondary hover:bg-secondary/80 text-foreground text-xs px-3 py-1.5 h-auto">
                  <Plus size={14} className="mr-1" /> Add Variant
                </Button>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="border border-border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Variant {index + 1}</span>
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(index)} className="text-destructive hover:text-red-300 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <FormField control={form.control} name={`variants.${index}.name`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Variant Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      <FormField control={form.control} name={`variants.${index}.sku`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">SKU (Auto if empty)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      <FormField control={form.control} name={`variants.${index}.price`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Price (৳)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      <FormField control={form.control} name={`variants.${index}.stock`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Stock</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>

                    {/* Readonly JSON viewer of attributes */}
                    {form.getValues(`variants.${index}.attributes`) && Object.keys(form.getValues(`variants.${index}.attributes`) || {}).length > 0 && (
                       <div className="flex gap-2 flex-wrap mt-2">
                         {Object.entries(form.getValues(`variants.${index}.attributes`) as Record<string, string>).map(([k, v]) => (
                           <div key={k} className="text-[10px] bg-muted border border-border px-2 py-0.5 rounded text-muted-foreground">
                             <span className="text-muted-foreground mr-1">{k}:</span>{v}
                           </div>
                         ))}
                       </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-card/80 border border-border rounded-xl p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Product Media</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Media updates are saved instantly. Use ★ to set the primary image.</p>
                </div>
                <Button type="button" onClick={() => setMediaPickerOpen(true)} className="shrink-0 bg-secondary hover:bg-secondary/80 text-foreground text-sm gap-2">
                  <Images size={16} /> Add Media
                </Button>
              </div>

              {uploadedMedia.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {uploadedMedia.map((item, index) => (
                    <div key={item.fileId} className={`relative rounded-lg overflow-hidden border-2 transition-colors ${item.isPrimary ? "border-sky-500" : "border-border"}`}>
                      {item.mediaType === "image" ? (
                        <Image src={`${item.url}${item.url.includes("?") ? "&" : "?"}tr=w-400`} alt={item.name} width={200} height={200} className="w-full h-32 object-cover" />
                      ) : (
                        <video src={item.url} className="w-full h-32 object-cover bg-black" muted playsInline />
                      )}
                      <div className="absolute top-1.5 right-1.5 flex gap-1">
                        {item.mediaType === "image" && (
                          <button type="button" onClick={() => setPrimaryImage(index)} className={`p-1 rounded-full text-xs ${item.isPrimary ? "bg-sky-500 text-foreground" : "bg-black/60 text-gray-300 hover:text-foreground"}`}>
                            <Star size={12} fill={item.isPrimary ? "white" : "none"} />
                          </button>
                        )}
                        <button type="button" onClick={() => removeMedia(index)} className="p-1 rounded-full bg-black/60 text-gray-300 hover:text-destructive transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-card/80 border border-border rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">External Media / YouTube Ads</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Add YouTube video links to display on the product page.</p>
                </div>
                <Button type="button" onClick={() => {
                  const current = form.getValues("youtubeUrls") || [];
                  form.setValue("youtubeUrls", [...current, ""]);
                }} className="bg-secondary hover:bg-secondary/80 text-foreground text-xs px-3 py-1.5 h-auto">
                  <Plus size={14} className="mr-1" /> Add YouTube Link
                </Button>
              </div>

              <div className="space-y-3">
                {form.watch("youtubeUrls")?.map((url, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1">
                      <Input
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={url}
                        onChange={(e) => {
                          const current = [...(form.getValues("youtubeUrls") || [])];
                          current[index] = e.target.value;
                          form.setValue("youtubeUrls", current);
                        }}
                      />
                    </div>
                    <Button type="button" variant="ghost" onClick={() => {
                      const current = [...(form.getValues("youtubeUrls") || [])];
                      current.splice(index, 1);
                      form.setValue("youtubeUrls", current);
                    }} className="text-destructive hover:text-destructive hover:bg-destructive/10 px-3">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                {(!form.watch("youtubeUrls") || form.watch("youtubeUrls")?.length === 0) && (
                  <div className="text-sm text-muted-foreground italic text-center py-4 border border-dashed border-border rounded-lg">
                    No YouTube links added yet.
                  </div>
                )}
              </div>
            </section>

            <div className="flex justify-end gap-3 pb-8">
              <Button type="button" variant="outline" onClick={() => router.push("/admin/products")}>Cancel</Button>
              <LoadingButton type="submit" loading={submitting}>Update Product</LoadingButton>
            </div>
          </form>
        </Form>
      </div>

      <ProductPreviewCard
        name={liveName}
        brand={liveBrand}
        price={livePrice}
        isFeatured={form.watch("isFeatured")}
        uploadedMedia={uploadedMedia}
        youtubeUrls={form.watch("youtubeUrls")}
      />

      <MediaPickerDialog open={mediaPickerOpen} onOpenChange={setMediaPickerOpen} defaultTab="library" multiple={true} allowedTypes="all" onSelect={handleMediaSelect} />
    </div>
  );
}
