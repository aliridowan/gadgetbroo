import prisma from "@/lib/prisma";

export type GetRolesParams = {
  page?: number;
  limit?: number;
};

/**
 * RoleService — single source of truth for the admin roles list query.
 * Called both by GET /api/roles (client-side re-fetch after create/edit/
 * delete/permission changes) and directly by roles/page.tsx and
 * users/page.tsx (both need the roles list — see users/page.tsx's own
 * comment for why), same reasoning as the other admin *Service modules.
 *
 * Uses `_count: { users: true }` rather than `users: true` — every
 * consumer of a role's user list only ever reads `.length` (a display
 * badge, a delete-guard), so fetching every full User row per role was
 * pure waste; a DB-computed COUNT gives the same information for a
 * fraction of the data transferred. DELETE /api/roles/[id] already used
 * this pattern for its own authoritative check — this just extends it to
 * the list view, which previously over-fetched.
 */
export const RoleService = {
  async getRoles(params: GetRolesParams = {}) {
    const { page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        include: { permissions: true, _count: { select: { users: true } } },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.role.count(),
    ]);

    return { roles, total, page, totalPages: Math.ceil(total / limit) };
  },
};
