import prisma from "@/lib/prisma";
import { Prisma } from "@/src/generated/prisma/client";

export type GetProductsParams = {
  search?: string;
  categoryId?: string;
  featured?: string; // "true" | "false" | "" (unset)
  stock?: string; // "in" | "low" | "out" | undefined (all)
  sortBy?: string;
  sortDir?: string; // "asc" | "desc"
  page?: number;
  limit?: number;
};

const productListInclude = {
  category: { select: { name: true, slug: true } },
  variants: {
    select: { id: true, name: true, sku: true, price: true, stock: true, isActive: true },
  },
  images: {
    where: { isPrimary: true },
    take: 1,
    select: { mediaFile: { select: { url: true, name: true } } },
  },
  _count: { select: { variants: true, images: true } },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productListInclude }>;

export type ProductListItem = ProductRow & {
  totalStock: number;
  stockStatus: "in" | "low" | "out";
  lowestPrice: number;
};

export type GetProductsResult = {
  products: ProductListItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

const productDetailInclude = {
  variants: { where: { isDeleted: false } },
  images: {
    include: { mediaFile: true },
    orderBy: { isPrimary: "desc" },
  },
} satisfies Prisma.ProductInclude;

export type ProductDetail = Prisma.ProductGetPayload<{ include: typeof productDetailInclude }>;

/**
 * ProductService — single source of truth for the admin products list query.
 * Called both by GET /api/products (client-side re-fetch on filter/page
 * change) and directly by products/page.tsx (initial page load), so the
 * query logic — where clause, pagination, and derived stock/price fields —
 * only lives in one place.
 */
// The only two columns ProductsClient's sort dropdown actually offers
// ("Sort: Date Added" / "Sort: Name"). orderBy is built from this value
// as a dynamic Prisma object key below — allowlisting here means a
// mistyped or hand-edited ?sortBy= just falls back to the default
// instead of throwing a PrismaClientValidationError and 500ing the page.
const SORTABLE_FIELDS = ["createdAt", "name"] as const;

export const ProductService = {
  async getProducts(params: GetProductsParams = {}): Promise<GetProductsResult> {
    const {
      search = "",
      categoryId = "",
      featured,
      stock,
      sortBy: sortByParam = "createdAt",
      sortDir: sortDirParam,
      page = 1,
      limit = 10,
    } = params;

    const sortBy = (SORTABLE_FIELDS as readonly string[]).includes(sortByParam)
      ? sortByParam
      : "createdAt";
    const sortDir: "asc" | "desc" = sortDirParam === "asc" ? "asc" : "desc";
    const skip = (page - 1) * limit;

    const whereClause: Prisma.ProductWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(featured === "true" && { isFeatured: true }),
      ...(featured === "false" && { isFeatured: false }),
      ...(stock === "out" && {
        variants: { none: { isActive: true, stock: { gt: 0 } } },
      }),
      ...(stock === "low" && {
        variants: { some: { isActive: true, stock: { gt: 0, lte: 5 } } },
      }),
      ...(stock === "in" && {
        variants: { some: { isActive: true, stock: { gt: 5 } } },
      }),
    };

    const [products, totalCount] = await prisma.$transaction([
      prisma.product.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: productListInclude,
        orderBy: { [sortBy]: sortDir },
      }),
      prisma.product.count({ where: whereClause }),
    ]);

    // Compute stock status + lowest active-variant price for the list UI —
    // these aren't stored columns, they're derived from the variants.
    const productsWithStock: ProductListItem[] = products.map((p) => {
      const activeVariants = p.variants.filter((v) => v.isActive);
      const totalStock = activeVariants.reduce((sum, v) => sum + v.stock, 0);
      const stockStatus: "in" | "low" | "out" =
        totalStock === 0 ? "out" : totalStock <= 5 ? "low" : "in";
      const lowestPrice = activeVariants.length > 0
        ? Math.min(...activeVariants.map((v) => Number(v.price)))
        : 0;
      return { ...p, totalStock, stockStatus, lowestPrice };
    });

    return {
      products: productsWithStock,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  },

  /**
   * Fetches a single product with its (non-deleted) variants and images for
   * the edit form. Shared by GET /api/products/[id] and
   * products/[id]/edit/page.tsx's initial server-side load, same reasoning
   * as getProducts above. Returns null if the id doesn't match a product —
   * callers decide how to respond (404 page vs. JSON 404).
   */
  async getProductById(id: string): Promise<ProductDetail | null> {
    return prisma.product.findUnique({
      where: { id },
      include: productDetailInclude,
    });
  },
};
