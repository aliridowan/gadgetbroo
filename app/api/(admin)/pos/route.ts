import { NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { posCheckoutSchema } from "@/zodSchemas/posSchema";
import { OrderService } from "@/lib/services/orderService";

export async function POST(req: Request) {
  try {
    const session = await checkPermission("POS", "canCreate");
    
    if (!session) {
      return NextResponse.json({ error: "Forbidden. You do not have permission to place POS orders." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = posCheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.format() }, { status: 400 });
    }

    const {
      customerName,
      customerPhone,
      customerAddress,
      state,
      city,
      paymentMethod,
      discount,
      items,
      notes,
    } = parsed.data;

    // Wrap everything in a Prisma transaction for hard-allocation (No Overselling)
    const order = await prisma.$transaction(async (tx) => {
      // 1. Verify stock and atomically lock inventory for each item — shared
      // with /api/checkout, see OrderService.reserveStockAndBuildItems for
      // why this has to be an atomic guarded decrement, not a separate
      // check-then-write.
      const { orderItemsData, subtotalCents } = await OrderService.reserveStockAndBuildItems(tx, items);

      // Look up Shipping Zone fee for the resolved location
      const shippingZone = await tx.shippingZone.findUnique({
        where: {
          stateName_cityName: {
            stateName: state,
            cityName: city,
          }
        }
      });

      if (!shippingZone) {
        throw new Error("Shipping is not available to the selected destination.");
      }

      const deliveryFeeCents = Math.round(Number(shippingZone.deliveryFee) * 100);
      const discountCents = Math.round(discount * 100);
      
      // Total = subtotal + shipping - discount
      let totalCents = subtotalCents + deliveryFeeCents - discountCents;
      if (totalCents < 0) totalCents = 0;

      const subtotal = subtotalCents / 100;
      const total = totalCents / 100;
      
      const fullAddress = `${customerAddress}, ${city}, ${state}`;
      
      // Determine Payment Status based on POS payment method — all three
      // are staff-witnessed, collected on the spot (cash in hand, a bKash
      // transfer confirmed in person, or a physical card terminal), so all
      // three are immediately PAID. Unlike the storefront's own BKASH/CARD
      // options (customer-initiated online, no live gateway, stay UNPAID
      // until an admin manually confirms), there's no "wait and verify"
      // step here — the sale already happened in front of staff.
      const paymentStatus = paymentMethod === "CASH" || paymentMethod === "MANUAL_BKASH" || paymentMethod === "MANUAL_CARD" ? "PAID" : "UNPAID";
      // POS orders always start CONFIRMED, not DELIVERED — POS isn't only
      // instant walk-in handoff, it's also used for orders sourced from
      // Facebook/Instagram entered in-shop, which still need normal
      // fulfillment tracking. Staying non-terminal keeps them manageable
      // through the same order-detail page as any other order.
      const orderStatus = "CONFIRMED";

      // Check if user already exists based on phone to prevent duplicates, or use guest logic
      // But actually, POS shouldn't fail if user doesn't exist. It can create an Address connected to the admin placing the order, or create an inline address for the order.
      // Wait, Order address relation expects an address. Let's create one connected to the admin, or let's create a guest Address? 
      // Actually, address model requires a userId. We can attach it to the admin's ID since they are processing it, or we can just create a dummy customer if they don't exist. 
      // For simplicity, we can just connect the address to the Admin placing the order, but that might clutter their addresses.
      // Let's create an inline Address. Wait, `userId` is required on Address. We'll use the admin's `session.user.id`.
      
      const newOrder = await tx.order.create({
        data: {
          customerName,
          customerPhone,
          customerAddress: fullAddress, // Kept for POS snapshot
          orderSource: "POS",
          subtotal,
          discount,
          total, // Subtotal + Delivery Fee - Discount
          paymentMethod,
          paymentStatus,
          status: orderStatus,
          adminNotes: notes,
          items: {
            create: orderItemsData
          }
        }
      });

      // Snapshot who actually rang up this sale — not just the FK, since a
      // shop can have multiple salespeople and this is meant to support
      // per-employee sales tracking later. Snapshotting name/email here
      // means that tracking stays accurate even if the account's name
      // later changes, same reasoning as the OrderItem price/name snapshots.
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "POS_ORDER_CREATED",
          entity: "Order",
          entityId: newOrder.id,
          metadata: {
            actorName: session.user.name,
            actorEmail: session.user.email,
            itemCount: orderItemsData.length,
            totalUnits: orderItemsData.reduce((sum, i) => sum + i.quantity, 0),
            total,
          },
        },
      });

      return newOrder;
    });

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error: unknown) {
    console.error("POS Transaction Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to process POS order" }, { status: 400 });
  }
}
