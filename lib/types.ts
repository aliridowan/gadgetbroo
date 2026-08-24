import { Prisma } from "../src/generated/prisma/client";

// This type exactly matches what prisma.user.findUnique({ include: { role: true } }) returns
export type FullUser = Prisma.UserGetPayload<{
  include: { role: true };
}>;



export interface Permission {
  id: string;
  resource: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  roleId: string;
}

export interface RoleData {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  permissions: Permission[];
  // A count, not the full rows — every consumer only ever needed
  // `.users.length`, so fetching every user row per role was pure waste.
  // Matches the `_count.users` shape DELETE /api/roles/[id] already used
  // for its own (still separate, still authoritative) server-side check.
  _count: { users: number };
}
