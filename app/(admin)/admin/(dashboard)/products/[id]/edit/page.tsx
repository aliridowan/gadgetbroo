// app/(admin)/admin/(dashboard)/products/[id]/edit/page.tsx
import { notFound } from "next/navigation";
import { checkPermission } from "@/lib/rbac";
import { ProductService } from "@/lib/services/productService";
import { CategoryService } from "@/lib/services/categoryService";
import type { UpdateProductValues } from "@/zodSchemas/productSchema";
import type { ProductOption } from "@/components/admin/DynamicOptionBuilder";
import EditProductClient from "./EditProductClient";

export default async function EditProductPage(props: {
  params: Promise<{ id: string }>;
}) {
  // Resource-specific gate matching what PATCH /api/products/[id] already
  // enforces — same reasoning as the "canCreate" check on the new-product
  // page (the /admin layout only checks for *some* permission, not this
  // specific one).
  const session = await checkPermission("Products", "canUpdate");
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to edit products.</div>;
  }

  const { id } = await props.params;

  const [product, { categories }] = await Promise.all([
    ProductService.getProductById(id),
    // Matches the client's original `fetch("/api/categories")` call — no
    // params, so CategoryService's own default limit (10) applies here too.
    CategoryService.getCategories(),
  ]);

  if (!product) notFound();

  // Prisma's Decimal (variant.price) can't cross the server → client
  // component boundary as-is (same issue as the products list page) — so
  // build the plain, form-ready defaultValues object here instead of
  // handing the raw Prisma row to the client. This also replaces the old
  // client-side `fetch` + `form.reset()` in a useEffect, which used to
  // flash "Loading product data..." on every visit.
  const initialValues: UpdateProductValues = {
    name: product.name,
    slug: product.slug,
    description: product.description,
    brand: product.brand,
    categoryId: product.categoryId,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    options: (product.options as ProductOption[] | null) ?? [],
    tags: product.tags ?? [],
    youtubeUrls: product.youtubeUrls ?? [],
    variants: product.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: Number(v.price),
      stock: v.stock,
      attributes: (v.attributes as Record<string, string> | null) ?? {},
      isActive: v.isActive,
    })),
  };

  const initialMedia = product.images.map((img) => ({
    id: img.id,
    url: img.mediaFile.url,
    fileId: img.mediaFile.fileId,
    name: img.mediaFile.name,
    isPrimary: img.isPrimary,
    mediaType: (img.mediaFile.fileType === "video" ? "video" : "image") as "image" | "video",
  }));

  return (
    <EditProductClient
      productId={id}
      initialCategories={categories}
      initialValues={initialValues}
      initialMedia={initialMedia}
    />
  );
}
