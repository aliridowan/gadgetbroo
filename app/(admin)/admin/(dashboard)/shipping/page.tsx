// app/(admin)/admin/(dashboard)/shipping/page.tsx
import { checkPermission } from "@/lib/rbac";
import { ShippingZoneService } from "@/lib/services/shippingZoneService";
import ShippingClient from "./ShippingClient";

export default async function ShippingZonesPage() {
  const session = await checkPermission("Shipping", "canView");
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to view this page.</div>;
  }

  const zones = await ShippingZoneService.getAllZones();

  return <ShippingClient initialZones={zones} />;
}
