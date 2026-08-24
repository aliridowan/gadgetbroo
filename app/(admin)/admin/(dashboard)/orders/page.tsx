import { Suspense } from "react";
import { checkPermission } from "@/lib/rbac";
import { OrderService } from "@/lib/services/orderService";
import { ShippingZoneService } from "@/lib/services/shippingZoneService";
import OrdersClient from "./OrdersClient";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function OrdersPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await checkPermission("Orders", "canView");
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to view this page.</div>;
  }

  const searchParams = await props.searchParams;
  const pageParam = first(searchParams.page);
  const page = pageParam ? parseInt(pageParam, 10) || 1 : 1;

  // Every filter OrdersClient reads is already URL-driven, so the initial
  // fetch here mirrors exactly what the client would otherwise request on
  // mount for the same URL — no default-state mismatch to account for.
  const [initialData, initialZones] = await Promise.all([
    OrderService.getOrders({
      page,
      search: first(searchParams.search),
      status: first(searchParams.status),
      district: first(searchParams.district),
      city: first(searchParams.city),
      from: first(searchParams.from),
      to: first(searchParams.to),
      sort: first(searchParams.sort),
      dir: first(searchParams.dir),
      limit: 15,
    }),
    ShippingZoneService.getZoneLocations(),
  ]);

  // OrdersClient still uses useSearchParams() internally for reactive
  // filter/page changes, so keep the same Suspense boundary + fallback the
  // original client-only page wrapped it in.
  return (
    <Suspense fallback={
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          Loading orders...
        </div>
      </div>
    }>
      <OrdersClient initialData={initialData} initialZones={initialZones} />
    </Suspense>
  );
}
