import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";
import { OrderService } from "@/lib/services/orderService";

export async function GET(request: NextRequest) {
  try {
    const session = await checkPermission("Orders", "canView");
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);

    const result = await OrderService.getOrders({
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : undefined,
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      district: searchParams.get("district") ?? undefined,
      city: searchParams.get("city") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      dir: searchParams.get("dir") ?? undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Orders GET error:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
