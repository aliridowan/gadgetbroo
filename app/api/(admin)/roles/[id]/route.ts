// app/api/(admin)/roles/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { getServerSession } from "../../../../../helpers/get-servesession";

import { checkPermission } from "@/lib/rbac";

/** PATCH /api/roles/[id]  — Update role name & description */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkPermission("Roles", "canUpdate");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { name, description } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Role name is required" }, { status: 400 });
  }

  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  // Prevent renaming the locked "admin" or "customer" roles
  if (role.name.toLowerCase() === "admin" || role.name === "customer") {
    return NextResponse.json(
      { error: `The "${role.name}" role name is locked and cannot be changed` },
      { status: 400 }
    );
  }

  // Check uniqueness if name is changing
  if (name.trim() !== role.name) {
    const conflict = await prisma.role.findUnique({ where: { name: name.trim() } });
    if (conflict) {
      return NextResponse.json({ error: "A role with that name already exists" }, { status: 400 });
    }
  }

  // _count instead of the full users array — same fix as GET /api/roles;
  // the client never actually reads this response's `role` field anyway
  // (it calls a separate fetchRoles() after a successful PATCH), but no
  // reason to over-fetch full user rows just to discard them.
  const updated = await prisma.role.update({
    where: { id },
    data: {
      name: name.trim(),
      description: description ?? role.description,
    },
    include: { permissions: true, _count: { select: { users: true } } },
  });

  return NextResponse.json({ role: updated });
}

/** DELETE /api/roles/[id]  — Delete role (blocked if users assigned) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkPermission("Roles", "canDelete");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });

  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (role.name.toLowerCase() === "admin" || role.name === "customer") {
    return NextResponse.json({ error: `The "${role.name}" role is system-protected and cannot be deleted` }, { status: 400 });
  }
  if (role._count.users > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${role._count.users} user(s) are assigned to this role` },
      { status: 400 }
    );
  }

  // Permissions cascade-delete via Prisma schema onDelete: Cascade
  await prisma.role.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
