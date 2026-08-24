import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { OrderService, TERMINAL_ORDER_STATUSES } from "@/lib/services/orderService";
const OrderStatus = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
const PaymentStatus = ["UNPAID", "PAID", "FAILED", "REFUNDED"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await checkPermission("Orders", "canView");
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const order = await OrderService.getOrderById(id);

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json({ order });
  } catch (error) {
    console.error("Order GET error:", error);
    return NextResponse.json({ error: "Failed to fetch order details" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await checkPermission("Orders", "canUpdate");
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();

    // Only allow updating specific fields
    const { status, paymentStatus, trackingNumber, adminNotes } = body;

    // ── Status change: the single guarded path. Once an order is
    // CANCELLED/DELIVERED/REFUNDED it can never change status again — this
    // is enforced atomically inside OrderService.transitionStatus, not just
    // by disabling the button client-side, so a direct API call can't
    // bypass it either. A status change also takes priority over any other
    // fields sent in the same request — the admin UI never combines them
    // (each save action PATCHes exactly one field), so this only matters
    // for a hypothetical direct API call, and it's simpler and safer to
    // have one clear rule than to partially apply a mixed payload.
    if (status !== undefined) {
      if (!OrderStatus.includes(status)) {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }

      const result = await OrderService.transitionStatus(id, status, session.user.id);

      if (!result.ok) {
        if (result.currentStatus === null) {
          return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }
        return NextResponse.json(
          { error: `This order is already ${result.currentStatus} and can no longer be modified.` },
          { status: 409 }
        );
      }

      return NextResponse.json({ order: result.order });
    }

    // ── Everything else (paymentStatus, trackingNumber, adminNotes).
    // adminNotes alone is always allowed regardless of order state — it's
    // the one thing that should stay editable no matter what happened to
    // the order. paymentStatus/trackingNumber are fulfillment-adjacent, so
    // they're blocked once the order is terminal, same as status.
    const wantsLockedFields = paymentStatus !== undefined || trackingNumber !== undefined;

    if (wantsLockedFields) {
      const existing = await prisma.order.findUnique({ where: { id }, select: { status: true } });
      if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      if (TERMINAL_ORDER_STATUSES.includes(existing.status)) {
        return NextResponse.json(
          { error: `This order is already ${existing.status} and can no longer be modified.` },
          { status: 409 }
        );
      }
    }

    const data: Record<string, string | null> = {};
    if (paymentStatus && PaymentStatus.includes(paymentStatus)) data.paymentStatus = paymentStatus;
    if (trackingNumber !== undefined) data.trackingNumber = trackingNumber;
    if (adminNotes !== undefined) data.adminNotes = adminNotes;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const order = await prisma.order.update({
      where: { id },
      data,
    });

    // Optionally log this in AuditLogs
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "ORDER_STATUS_UPDATED",
        entity: "Order",
        entityId: order.id,
        metadata: data,
      }
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Order PATCH error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
