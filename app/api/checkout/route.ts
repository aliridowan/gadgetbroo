import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { OrderService } from "@/lib/services/orderService";

import { checkoutSchema } from "@/zodSchemas/checkoutSchema";

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: "You must be logged in to checkout." }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const {
      addressId,
      fullName,
      phone,
      line1,
      city,
      state,
      postalCode,
      saveAddress,
      paymentMethod,
      items,
    } = parsed.data;

    // Wrap everything in a Prisma transaction for hard-allocation (No Overselling)
    const order = await prisma.$transaction(async (tx) => {
      // 1. Verify stock and atomically lock inventory for each item — shared
      // with /api/pos, see OrderService.reserveStockAndBuildItems for why
      // this has to be an atomic guarded decrement, not a separate
      // check-then-write.
      const { orderItemsData, subtotalCents } = await OrderService.reserveStockAndBuildItems(tx, items);

      // 2. Resolve the final Address and Shipping Zone
      let finalAddressId = "";
      let finalState = "";
      let finalCity = "";

      if (addressId) {
        // User selected an existing address
        const existingAddress = await tx.address.findUnique({
          where: { id: addressId },
        });

        if (!existingAddress || existingAddress.userId !== userId) {
          throw new Error("Invalid address selected.");
        }

        finalAddressId = existingAddress.id;
        finalState = existingAddress.state;
        finalCity = existingAddress.city;
      } else {
        // User provided a new address
        if (!fullName || !phone || !line1 || !city || !state) {
          throw new Error("Missing required address fields.");
        }

        // If they want to save it as default, we could unset others here.
        // For now, we'll just set it to default if it's their first address or if they chose saveAddress
        const newAddress = await tx.address.create({
          data: {
            userId,
            fullName,
            phone,
            line1,
            city,
            state,
            postalCode: postalCode || "0000",
            country: "BD",
            isDefault: saveAddress || false,
          }
        });

        finalAddressId = newAddress.id;
        finalState = newAddress.state;
        finalCity = newAddress.city;
      }

      // Look up Shipping Zone fee for the resolved location
      const shippingZone = await tx.shippingZone.findUnique({
        where: {
          stateName_cityName: {
            stateName: finalState,
            cityName: finalCity,
          }
        }
      });

      if (!shippingZone) {
        throw new Error("Shipping is not available to the selected destination.");
      }

      // Calculate final totals in cents
      const deliveryFeeCents = Math.round(Number(shippingZone.deliveryFee) * 100);
      const totalCents = subtotalCents + deliveryFeeCents;

      const subtotal = subtotalCents / 100;
      const total = totalCents / 100;

      // 3. Create the Final Order
      // paymentMethod is already validated against the exact three values
      // the storefront offers (checkoutSchema.paymentMethod), so this can
      // pass straight through instead of collapsing anything unrecognized
      // into CASH_ON_DELIVERY — that used to be how a client-side-only
      // "STRIPE" submission still ended up recorded (misleadingly) as COD.
      // All three start UNPAID/PENDING the same way COD always has —
      // bKash and Card aren't live gateways, an admin confirms payment
      // and updates paymentStatus by hand from the order detail page.
      const newOrder = await tx.order.create({
        data: {
          userId,
          addressId: finalAddressId,
          subtotal,
          total, // Subtotal + Delivery Fee (discount is 0 by default)
          paymentMethod,
          status: "PENDING",
          paymentStatus: "UNPAID",
          items: {
            create: orderItemsData
          }
        }
      });

      return newOrder;
    });

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error: unknown) {
    console.error("Checkout Transaction Error:", error);
    // Return 400 Bad Request with the specific error message (e.g., "Out of stock")
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to process checkout" }, { status: 400 });
  }
}
