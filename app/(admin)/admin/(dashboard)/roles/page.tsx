// app/(admin)/admin/(dashboard)/roles/page.tsx
import { checkPermission } from "@/lib/rbac";
import { RoleService } from "@/lib/services/roleService";
import RolesClient from "./RolesClient";
import type { RoleData } from "@/lib/types";

export default async function RolesPage() {
  const session = await checkPermission("Roles", "canView");
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to view this page.</div>;
  }

  // Matches the client's original `fetch("/api/roles/")` call — no params,
  // so RoleService's own defaults (page=1, limit=10) apply here too.
  const { roles } = await RoleService.getRoles();

  // Dates need to be plain strings to cross the server → client component
  // boundary as the RoleData type (shared with the client) already expects.
  const initialRoles: RoleData[] = roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    permissions: r.permissions,
    _count: r._count,
  }));

  return <RolesClient initialRoles={initialRoles} />;
}
