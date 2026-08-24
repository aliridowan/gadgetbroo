import prisma from "@/lib/prisma";

export type GetCategoriesParams = {
  page?: number;
  limit?: number;
};

export type CategoryWithCount = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  isActive: boolean;
  _count: { products: number };
};

export type GetCategoriesResult = {
  categories: CategoryWithCount[];
  total: number;
  page: number;
  totalPages: number;
};

/**
 * CategoryService — single source of truth for the admin categories query.
 * Called both by GET /api/categories (client-side re-fetch after a
 * create/edit/delete) and directly by category/page.tsx (initial page load).
 */
export const CategoryService = {
  async getCategories(params: GetCategoriesParams = {}): Promise<GetCategoriesResult> {
    const { page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        include: { _count: { select: { products: true } } },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.category.count(),
    ]);

    return { categories, total, page, totalPages: Math.ceil(total / limit) };
  },
};
