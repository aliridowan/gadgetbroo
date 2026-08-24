import prisma from "@/lib/prisma";
import type { OrderStatus } from "@/src/generated/prisma/client";
import { Prisma } from "@/src/generated/prisma/client";

// Once an order reaches one of these, its status (and paymentStatus /
// trackingNumber) can never change again — enforced atomically in
// transitionStatus below, not just hidden in the UI. adminNotes is exempt
// on purpose; see the route.
export const TERMINAL_ORDER_STATUSES: OrderStatus[] = ["CANCELLED", "DELIVERED", "REFUNDED"];

// Of the terminal statuses, only these two mean "the item didn't end up
// with the customer" — DELIVERED means it did, so it's terminal but never
// restocks.
export const RESTOCK_ON_STATUSES: OrderStatus[] = ["CANCELLED", "REFUNDED"];

export type TransitionStatusResult =
  | { ok: true; order: Awaited<ReturnType<typeof prisma.order.findUniqueOrThrow>> }
  | { ok: false; currentStatus: OrderStatus | null };

export type CartItemInput = { variantId: string; quantity: number };

export type ReservedOrderItem = {
  variantId: string;
  quantity: number;
  priceAtOrder: number;
  productName: string;
  variantName: string;
  skuAtOrder: string;
  imageSnapshot: string | null;
};

export type GetOrdersParams = {
  page?: number;
  search?: string;
  status?: string;
  district?: string;
  city?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
  limit?: number;
};

/**
 * OrderService — single source of truth for the admin orders list + detail
 * queries. Called both by the /api/orders* routes (client-side re-fetch on
 * filter/page/status change) and directly by orders/page.tsx and
 * orders/[id]/page.tsx (initial page load), same reasoning as the other
 * admin *Service modules.
 *
 * The where-clause construction here is copied verbatim from the original
 * /api/orders route (including its existing `any` typing and the
 * pre-existing `customerPhone` fallback quirk below) — this is a pure
 * extraction, not a rewrite, so behavior is guaranteed unchanged.
 */
export const OrderService = {
  async getOrders(params: GetOrdersParams = {}) {
    const {
      page = 1,
      search = "",
      status = "",
      district = "",
      city = "",
      from = "",
      to = "",
      limit = 20, // matches the original route's default; the client always sends 15 explicitly
      // sort/dir intentionally not destructured — see the orderBy note below.
    } = params;

    const where: any = { AND: [] };

    if (search) {
      where.AND.push({
        OR: [
          { id: { contains: search, mode: "insensitive" } },
          { customerName: { contains: search, mode: "insensitive" } },
          { customerPhone: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (status) where.AND.push({ status });
    if (district) where.AND.push({ address: { state: district } });
    if (city) where.AND.push({ address: { city } });
    if (from || to) {
      const dateFilter: any = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }
      where.AND.push({ createdAt: dateFilter });
    }

    const finalWhere = where.AND.length > 0 ? where : {};
    const skip = (page - 1) * limit;

    // NOTE: `sort`/`dir` are accepted (the UI sends them, the client type
    // has them) but — matching the original route exactly — never actually
    // applied. orderBy is hardcoded here, same as it always was. This is a
    // pre-existing no-op, not something introduced by this extraction; not
    // fixing it as part of a pure server/client split.
    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where: finalWhere,
        include: {
          user: { select: { name: true, email: true } },
          address: { select: { state: true, city: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where: finalWhere }),
    ]);

    const orders = rows.map((o) => ({
      id: o.id,
      orderCode: `#${o.id.slice(-8).toUpperCase()}`,
      customerName: o.customerName || o.user?.name || "Unknown",
      customerPhone: o.customerPhone || o.user?.email || "Unknown",
      district: o.address?.state || "",
      city: o.address?.city || "",
      status: o.status,
      total: Number(o.total),
      createdAt: o.createdAt.toISOString(),
    }));

    return { orders, total, page, pages: Math.ceil(total / limit) };
  },

  async getOrderById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true, id: true } },
        address: true,
        items: true,
      },
    });
  },

  /**
   * The single, guarded path for changing an order's status. Once an order
   * is in a terminal state (see TERMINAL_ORDER_STATUSES), this refuses to
   * change it again — including "changing" it to the same terminal status
   * again — no matter how many times or how concurrently it's called.
   *
   * The safety here comes from the `updateMany` below, not from any read
   * that happens before it: its `where` re-checks the current status at
   * the moment that specific UPDATE statement runs, and a concurrent
   * transaction attempting the same thing blocks on the row lock and then
   * re-evaluates against the now-committed state — so two simultaneous
   * cancel requests can't both succeed and double-restock. The initial
   * `findUnique` below exists only to report *what* the current status is
   * for the error message / audit log, not to decide anything.
   */
  async transitionStatus(
    orderId: string,
    newStatus: OrderStatus,
    actorId: string
  ): Promise<TransitionStatusResult> {
    return prisma.$transaction(async (tx) => {
      const before = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (!before) return { ok: false, currentStatus: null };

      const result = await tx.order.updateMany({
        where: { id: orderId, status: { notIn: TERMINAL_ORDER_STATUSES } },
        data: { status: newStatus },
      });

      if (result.count === 0) {
        return { ok: false, currentStatus: before.status };
      }

      const restockedItems: { variantId: string; sku: string; quantity: number }[] = [];

      if (RESTOCK_ON_STATUSES.includes(newStatus)) {
        const items = await tx.orderItem.findMany({
          where: { orderId },
          select: { variantId: true, quantity: true, skuAtOrder: true },
        });
        for (const item of items) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
          restockedItems.push({
            variantId: item.variantId,
            sku: item.skuAtOrder,
            quantity: item.quantity,
          });
        }
      }

      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

      await tx.auditLog.create({
        data: {
          actorId,
          action: `ORDER_${newStatus}`,
          entity: "Order",
          entityId: orderId,
          metadata: {
            previousStatus: before.status,
            newStatus,
            restockedItems,
            totalUnitsRestocked: restockedItems.reduce((sum, i) => sum + i.quantity, 0),
          },
        },
      });

      return { ok: true, order };
    });
  },

  /**
   * Shared by /api/checkout and /api/pos — both used to run nearly
   * identical copies of this loop (verify variant availability, check
   * stock, decrement, build the OrderItem snapshot), including the same
   * race condition: `if (variant.stock < item.quantity)` read separately
   * from the `stock: variant.stock - item.quantity` write meant two
   * concurrent requests for the last unit could both pass the check before
   * either committed, overselling it.
   *
   * Fixed the same way as the restock side of transitionStatus above: the
   * decrement is a single atomic conditional update
   * (`stock: { gte: quantity }` guarding `stock: { decrement: quantity }`)
   * whose affected-row count tells us whether it actually happened, not a
   * separate read that can go stale between check and write.
   *
   * Must be called with the `tx` from the caller's own $transaction — the
   * decrement only means anything if it's part of the same atomic order-
   * creation transaction as everything else (address resolution, shipping
   * fee lookup, the final Order.create).
   */
  async reserveStockAndBuildItems(
    tx: Prisma.TransactionClient,
    items: CartItemInput[]
  ): Promise<{ orderItemsData: ReservedOrderItem[]; subtotalCents: number }> {
    let subtotalCents = 0;
    const orderItemsData: ReservedOrderItem[] = [];

    for (const item of items) {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        include: {
          product: {
            include: {
              images: {
                where: { isPrimary: true },
                include: { mediaFile: true },
                take: 1,
              },
            },
          },
        },
      });

      if (!variant || variant.isDeleted || !variant.isActive || !variant.product.isActive) {
        throw new Error(`Product variant ${item.variantId} is no longer available.`);
      }

      const decremented = await tx.productVariant.updateMany({
        where: { id: variant.id, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });

      if (decremented.count === 0) {
        // Re-read rather than trust the `variant.stock` from above — that
        // was read before the guarded update ran, so under a real race it
        // could already be stale by the time we're reporting "how many
        // are left."
        const current = await tx.productVariant.findUnique({
          where: { id: variant.id },
          select: { stock: true },
        });
        throw new Error(
          `Out of stock: ${variant.product.name}. Only ${current?.stock ?? 0} left in stock, but you requested ${item.quantity}.`
        );
      }

      const priceCents = Math.round(Number(variant.price) * 100);
      subtotalCents += priceCents * item.quantity;

      const primaryImage = variant.product.images[0]?.mediaFile.url || null;

      orderItemsData.push({
        variantId: variant.id,
        quantity: item.quantity,
        priceAtOrder: priceCents / 100,
        productName: variant.product.name,
        variantName: variant.name !== "Default" ? variant.name : "Standard Edition",
        skuAtOrder: variant.sku,
        imageSnapshot: primaryImage,
      });
    }

    return { orderItemsData, subtotalCents };
  },
};
