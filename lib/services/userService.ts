import prisma from "@/lib/prisma";

export type GetUsersParams = {
  page?: number;
  limit?: number;
};

/**
 * UserService — single source of truth for the admin users list query.
 * Called both by GET /api/user (client-side re-fetch after create/edit/
 * delete) and directly by users/page.tsx (initial page load), same
 * reasoning as the other admin *Service modules.
 */
export const UserService = {
  async getUsers(params: GetUsersParams = {}) {
    const { page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        include: { role: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count(),
    ]);

    return { users, total, page, totalPages: Math.ceil(total / limit) };
  },
};
