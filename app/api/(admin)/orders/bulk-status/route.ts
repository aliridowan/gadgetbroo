import { NextResponse } from "next/server";

/**
 * PATCH /api/orders/bulk-status — disabled.
 *
 * This used to blindly `updateMany` a status onto every selected order,
 * with no per-order state check, no restock logic, and no audit log entry
 * — meaning it could silently overwrite an already-CANCELLED/DELIVERED/
 * REFUNDED order's status and desync inventory, completely bypassing the
 * guarded single-order transition in OrderService.transitionStatus.
 *
 * Refusing here (not just hiding the bulk UI in OrdersClient) so a direct
 * API call can't use it either. Re-enable only once it's rebuilt as a loop
 * over OrderService.transitionStatus per order, so each one gets the same
 * atomic guard and restock/audit handling as a single-order update.
 */
export async function PATCH() {
  return NextResponse.json(
    { error: "Bulk order status updates are temporarily disabled. Update orders one at a time." },
    { status: 403 }
  );
}
