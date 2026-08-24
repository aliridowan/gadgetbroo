import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { createRoleSchema } from "../../../../zodSchemas/createRoleSchema";
import { requireAdmin } from "../../../../lib/rbac";
import { RoleService } from "../../../../lib/services/roleService";

export async function GET(request: NextRequest) {
  try {
    // Check session and role
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { searchParams } = new URL(request.url);

    const result = await RoleService.getRoles({
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to fetch roles" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {

  try {
    // Check session and role
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // get the body 
    const body = await request.json()
    // safeParse with the zod schema 
    const result = createRoleSchema.safeParse(body);


    if (!result.success) {
      return NextResponse.json(
        {
          error: "Only name and description are nedded and allowed"
        },
        { status: 400 }
      );
    }

    const { name, description } = result.data;


    const existing = await prisma.role.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json({ error: "Role name already exists" }, { status: 400 })
    }

    const role = await prisma.role.create({
      data: {
        name,
        description: description || "",
      },
      include: {
        permissions: true,
      },
    })

    if (!role) return NextResponse.json({ error: "Can't Crete role. Server Eroor" }, { status: 500 });
    return NextResponse.json({ success: `Role created successfully`, role }, { status: 200 })


  } catch (error) {
    return NextResponse.json({ error: "cann't added new role" }, { status: 500 })
  }
}
