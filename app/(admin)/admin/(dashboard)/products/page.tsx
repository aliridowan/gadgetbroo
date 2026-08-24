// app/(admin)/admin/(dashboard)/products/page.tsx
import { checkPermission } from "@/lib/rbac";
import { ProductService } from "@/lib/services/productService";
import { CategoryService } from "@/lib/services/categoryService";
import ProductsClient from "./ProductsClient";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ProductsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await checkPermission("Products", "canView");
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to view this page.</div>;
  }

  const searchParams = await props.searchParams;
  const pageParam = first(searchParams.page);
  const page = pageParam ? parseInt(pageParam, 10) || 1 : 1;

  // Filters live in the URL (search, categoryId, featured, stock, sortBy,
  // sortDir) — same keys/defaults ProductsClient reads and writes — so a
  // pasted link reproduces the exact same filtered, sorted, paginated list
  // for whoever opens it, instead of everyone always landing on the
  // unfiltered default view.
  const search = first(searchParams.search) || "";
  const categoryId = first(searchParams.categoryId) || "";
  const featured = first(searchParams.featured) || "";
  const stock = first(searchParams.stock) || "all";
  const sortBy = first(searchParams.sortBy) || "createdAt";
  const sortDir = first(searchParams.sortDir) || "desc";

  // Categories mirror the client's original `fetch("/api/categories")` call
  // — no params, so CategoryService's own default limit (10) applies here too.
  const [{ products, totalPages }, { categories }] = await Promise.all([
    ProductService.getProducts({
      search,
      categoryId,
      featured,
      stock: stock === "all" ? undefined : stock,
      sortBy,
      sortDir,
      page,
      limit: 15,
    }),
    CategoryService.getCategories(),
  ]);

  // Prisma's Decimal (product.variants[].price) can't cross the server →
  // client component boundary as-is, and the client only ever reads
  // `_count.variants`, not the variant rows themselves — so trim each
  // product down to the plain, client-safe shape before handing it off.
  const initialProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    category: p.category,
    images: p.images,
    lowestPrice: p.lowestPrice,
    totalStock: p.totalStock,
    stockStatus: p.stockStatus,
    _count: p._count,
  }));

  return (
    <ProductsClient
      initialProducts={initialProducts}
      initialTotalPages={totalPages}
      initialCategories={categories}
    />
  );
}
