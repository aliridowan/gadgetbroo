import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";
import { ReviewService } from "@/lib/services/reviewService";

import { updateReviewVisibilitySchema } from "@/zodSchemas/reviewSchema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await checkPermission("Reviews", "canUpdate");
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const parsed = updateReviewVisibilitySchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid field" }, { status: 400 });
    }

    const { isVisible } = parsed.data;

    const review = await ReviewService.updateVisibility(id, isVisible);

    return NextResponse.json({ review });
  } catch (error) {
    console.error("Review PATCH error:", error);
    return NextResponse.json({ error: "Failed to update review" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await checkPermission("Reviews", "canDelete");
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;

    await ReviewService.deleteReview(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Review DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
}
