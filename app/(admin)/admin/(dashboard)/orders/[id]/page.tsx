import { notFound } from "next/navigation";
import { checkPermission } from "@/lib/rbac";
import { OrderService } from "@/lib/services/orderService";
import OrderDetailsClient from "./OrderDetailsClient";

export default async function OrderDetailsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await checkPermission("Orders", "canView");
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to view this page.</div>;
  }

  const { id } = await props.params;
  const order = await OrderService.getOrderById(id);
  if (!order) notFound();

  // Prisma Decimal fields (subtotal/discount/total/each item's
  // priceAtOrder) can't cross the server → client component boundary as-is
  // — same discipline as the products pages — so build the plain,
  // client-ready shape here instead of handing the raw Prisma row over.
  const initialOrder = {
    id: order.id,
    createdAt: order.createdAt.toISOString(),
    status: order.status,
    items: order.items.map((item) => ({
      id: item.id,
      imageSnapshot: item.imageSnapshot,
      productName: item.productName,
      variantName: item.variantName,
      skuAtOrder: item.skuAtOrder,
      priceAtOrder: Number(item.priceAtOrder),
      quantity: item.quantity,
    })),
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    total: Number(order.total),
    user: order.user ? { name: order.user.name, email: order.user.email } : null,
    address: order.address
      ? {
          fullName: order.address.fullName,
          line1: order.address.line1,
          line2: order.address.line2,
          city: order.address.city,
          state: order.address.state,
          postalCode: order.address.postalCode,
          country: order.address.country,
          phone: order.address.phone,
        }
      : null,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    orderSource: order.orderSource,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    trackingNumber: order.trackingNumber,
    adminNotes: order.adminNotes,
  };

  return <OrderDetailsClient orderId={id} initialOrder={initialOrder} />;
}
