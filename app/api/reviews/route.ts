import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/helpers/get-servesession";
import { checkPermission } from "@/lib/rbac";
import { createReviewSchema } from "@/zodSchemas/reviewSchema";
import { ReviewService } from "@/lib/services/reviewService";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json();
    const parsed = createReviewSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { productId, rating, title, content } = parsed.data;

    // Check if the user has purchased this product and it was DELIVERED
    // A user might have bought multiple variants of the same product, we just need one delivered order item.
    const deliveredOrder = await prisma.orderItem.findFirst({
      where: {
        order: {
          userId,
          status: "DELIVERED",
        },
        variant: {
          productId,
        }
      }
    });

    if (!deliveredOrder) {
      return NextResponse.json(
        { error: "You can only review products you have purchased and received." },
        { status: 403 }
      );
    }

    // Check if review already exists
    const existingReview = await prisma.review.findUnique({
      where: {
        productId_userId: {
          productId,
          userId,
        }
      }
    });

    if (existingReview) {
      return NextResponse.json({ error: "You have already reviewed this product." }, { status: 409 });
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        productId,
        userId,
        rating,
        title,
        body: content,
        isVisible: true,
      }
    });

    return NextResponse.json({ review });
  } catch (error) {
    console.error("Review POST error:", error);
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await checkPermission("Reviews", "canView");
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const result = await ReviewService.getReviews({ search, page, limit });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Reviews GET error:", error);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}
