import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";
import { ShippingZoneService } from "@/lib/services/shippingZoneService";

export async function GET(req: NextRequest) {
  try {
    // Was previously unauthenticated — this route can create/update/delete
    // zones too (see POST below and [id]/route.ts), so it's not just a
    // read gate here for consistency, it's closing an actual open write
    // hole. Matches the "Shipping" resource Sidebar.tsx already declares.
    const session = await checkPermission("Shipping", "canView");
    if (!session) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const zones = await ShippingZoneService.getAllZones();
    return NextResponse.json({ success: true, data: zones });
  } catch (error: unknown) {
    console.error("Error fetching shipping zones:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await checkPermission("Shipping", "canCreate");
    if (!session) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { stateName, cityName, deliveryFee, isActive } = body;

    if (!stateName || !cityName || deliveryFee === undefined) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const zone = await ShippingZoneService.createZone({
      stateName,
      cityName,
      deliveryFee: parseFloat(deliveryFee),
      isActive,
    });

    return NextResponse.json({ success: true, data: zone });
  } catch (error: unknown) {
    console.error("Error creating shipping zone:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ success: false, error: "A shipping zone for this state and city already exists." }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
