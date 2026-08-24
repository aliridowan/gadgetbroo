import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import prisma from "../../../../lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const body = await request.json();
    const { items, action } = body; 
    // action: "sync" (upsert all), "add", "update", "remove", "clear"

    // Ensure cart exists
    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    if (action === "clear") {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    } 
    else if (action === "remove" && items?.[0]?.variantId) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id, variantId: items[0].variantId }
      });
    }
    else if (action === "sync" || action === "add" || action === "update") {
      // Upsert the provided items — batched, not one read-write-reread-write
      // round trip per line item. The old version did up to 4 sequential
      // awaited queries per item (find the variant, upsert, re-fetch to
      // check the increment didn't overshoot stock, maybe correct it); a
      // 10-item cart was 20-40 round trips on a single request.
      //
      // Same effective math, computed up front instead of write-then-check:
      //   safeQty  = min(requested quantity, stock)              — as before
      //   finalQty = "add"/"sync" → min(existingQty + safeQty, stock)
      //              "update"     → safeQty  (already ≤ stock)
      // "add"'s finalQty is exactly what the old increment-then-clamp
      // produced, just derived before the write instead of corrected after
      // it — so there's one write per item instead of up to three.
      //
      // "sync" shares add's additive math, not update's — sync only ever
      // fires once, from CartSync.tsx on login, reconciling whatever was
      // in localStorage (now correctly empty unless it's a guest cart from
      // *this* session, per the logout fix) against the account's saved
      // DB cart. Overlapping items should combine, not have whichever side
      // synced last silently discard the other's quantity — a guest who
      // had 2 of something and adds 3 more into an account that already
      // had 4 saved should end up with 7 (clamped to stock), not 3.
      // "update" is different on purpose: it's the qty stepper in
      // cart/page.tsx, which already computes the exact target quantity
      // client-side (current ± 1) — adding that to the existing DB value
      // would double-count every click.
      const validItems = Array.isArray(items)
        ? items.filter((item: { variantId?: string; quantity?: number }) => item.variantId && item.quantity)
        : [];

      if (validItems.length > 0) {
        const variantIds = validItems.map((item) => item.variantId as string);

        const [variants, existingCartItems] = await Promise.all([
          prisma.productVariant.findMany({ where: { id: { in: variantIds } } }),
          prisma.cartItem.findMany({ where: { cartId: cart.id, variantId: { in: variantIds } } }),
        ]);

        const variantById = new Map(variants.map((v) => [v.id, v]));
        const existingQtyByVariantId = new Map(existingCartItems.map((ci) => [ci.variantId, ci.quantity]));

        const upserts = validItems
          .map((item) => {
            const variant = variantById.get(item.variantId as string);
            if (!variant) return null; // Skip invalid variants, same as before

            const safeQty = Math.min(item.quantity as number, variant.stock);
            const existingQty = existingQtyByVariantId.get(variant.id) ?? 0;
            const finalQty = (action === "add" || action === "sync")
              ? Math.min(existingQty + safeQty, variant.stock)
              : safeQty;

            return prisma.cartItem.upsert({
              where: {
                cartId_variantId: { cartId: cart.id, variantId: variant.id }
              },
              create: {
                cartId: cart.id,
                variantId: variant.id,
                quantity: finalQty
              },
              update: {
                quantity: finalQty
              }
            });
          })
          .filter((op): op is NonNullable<typeof op> => op !== null);

        // One batched round trip for every item's write, instead of N
        // sequential ones — same "each item's write is independent" shape
        // as the original loop, just sent together.
        if (upserts.length > 0) {
          await prisma.$transaction(upserts);
        }
      }
    }

    // Fetch the updated cart to return to the client
    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: { name: true, images: { where: { isPrimary: true }, take: 1, select: { mediaFile: true } } }
                }
              }
            }
          }
        }
      }
    });

    return NextResponse.json({ success: true, cart: updatedCart });
  } catch (error) {
    console.error("Cart Sync Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: session.user.id },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: { name: true, images: { where: { isPrimary: true }, take: 1, select: { mediaFile: true } } }
                }
              }
            }
          }
        }
      }
    });

    return NextResponse.json({ success: true, cart });
  } catch (error) {
    console.error("Cart Fetch Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
