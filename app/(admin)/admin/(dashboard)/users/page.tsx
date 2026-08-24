// app/(admin)/admin/(dashboard)/users/page.tsx
import { checkPermission } from "@/lib/rbac";
import { UserService } from "@/lib/services/userService";
import { RoleService } from "@/lib/services/roleService";
import UsersClient from "./UsersClient";
import type { RoleData } from "@/lib/types";

export default async function UsersPage() {
  const session = await checkPermission("Users", "canView");
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to view this page.</div>;
  }

  // The users page genuinely needs both lists — the role dropdown in
  // EditUserModal, and CreateUserButton (which, despite living in
  // roles/HandleRoleAction.tsx, is used here and takes the roles array as
  // a prop) — mirroring the client's original `Promise.all([users, roles])`.
  const [{ users }, { roles }] = await Promise.all([
    UserService.getUsers(),
    RoleService.getRoles(),
  ]);

  // No mapping needed for users — FullUser's type comes straight from
  // Prisma (Prisma.UserGetPayload<{ include: { role: true } }>), so its
  // Dates are typed as Date, not string, and there's no Decimal anywhere
  // in the User/Role/Permission domain — nothing here can't cross the
  // server → client component boundary as-is.
  const initialUsers = users;

  // RoleData, unlike FullUser, is a hand-authored type that declares
  // createdAt/updatedAt as `string` — so this one does need converting.
  const initialRoles: RoleData[] = roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    permissions: r.permissions,
    _count: r._count,
  }));

  return <UsersClient initialUsers={initialUsers} initialRoles={initialRoles} />;
}
