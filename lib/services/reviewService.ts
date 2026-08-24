import prisma from "@/lib/prisma";

export type ReviewListItem = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  isVisible: boolean;
  createdAt: Date;
  user: { name: string; email: string };
  product: { name: string; slug: string };
};

export type ReviewListResult = {
  reviews: ReviewListItem[];
  total: number;
  page: number;
  totalPages: number;
};

/**
 * ReviewService — single source of truth for the admin Reviews
 * moderation list (GET/PATCH/DELETE /api/reviews). Called both by
 * those routes and directly by reviews/page.tsx (initial page load),
 * same reasoning as the other admin *Service modules.
 *
 * Does NOT cover review submission (POST /api/reviews) or storefront
 * display (product/[slug]/page.tsx reads Review directly via prisma,
 * filtered to isVisible: true) — both are customer-facing, unrelated
 * to admin moderation, and out of scope here.
 */
export const ReviewService = {
  async getReviews(params: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ReviewListResult> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    const search = params.search?.trim();
    const skip = (page - 1) * limit;

    const where = {
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { body: { contains: search, mode: "insensitive" as const } },
          { user: { name: { contains: search, mode: "insensitive" as const } } },
          { product: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }),
    };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          product: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    return { reviews, total, page, totalPages: Math.ceil(total / limit) };
  },

  async updateVisibility(id: string, isVisible: boolean) {
    return prisma.review.update({
      where: { id },
      data: { isVisible },
    });
  },

  async deleteReview(id: string) {
    await prisma.review.delete({ where: { id } });
  },
};
