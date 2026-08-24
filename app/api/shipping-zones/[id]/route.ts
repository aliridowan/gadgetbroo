import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";
import { ShippingZoneService } from "@/lib/services/shippingZoneService";

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await checkPermission("Shipping", "canUpdate");
    if (!session) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const params = await props.params;
    const body = await req.json();
    const { stateName, cityName, deliveryFee, isActive } = body;

    const updatedZone = await ShippingZoneService.updateZone(params.id, {
      stateName,
      cityName,
      deliveryFee: deliveryFee !== undefined ? parseFloat(deliveryFee) : undefined,
      isActive,
    });

    return NextResponse.json({ success: true, data: updatedZone });
  } catch (error: unknown) {
    console.error("Error updating shipping zone:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ success: false, error: "A shipping zone for this state and city already exists." }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await checkPermission("Shipping", "canDelete");
    if (!session) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const params = await props.params;
    await ShippingZoneService.deleteZone(params.id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting shipping zone:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
