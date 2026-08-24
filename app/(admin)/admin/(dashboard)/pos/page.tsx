import { checkPermission } from "@/lib/rbac";
import { ProductService } from "@/lib/services/productService";
import { ShippingZoneService } from "@/lib/services/shippingZoneService";
import POSClient from "./POSClient";

export default async function POSPage() {
  // Matches the API route's own gate — POS is its own resource, not the
  // same "Products"/"Orders" permissions used elsewhere.
  const session = await checkPermission("POS", "canCreate");
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to use POS.</div>;
  }

  // Matches the client's original `fetch("/api/products?limit=50")` call.
  const [{ products }, shippingZones] = await Promise.all([
    ProductService.getProducts({ limit: 50 }),
    ShippingZoneService.getAllZones(),
  ]);

  // Prisma's Decimal (variant.price) can't cross the server → client
  // component boundary as-is — same discipline as every other admin page
  // that hands product data to a client component.
  const initialProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    images: p.images,
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: Number(v.price),
      stock: v.stock,
    })),
  }));

  return <POSClient initialProducts={initialProducts} initialShippingZones={shippingZones} />;
}
