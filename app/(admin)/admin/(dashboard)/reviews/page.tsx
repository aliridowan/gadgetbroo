// app/(admin)/admin/(dashboard)/reviews/page.tsx
import { Suspense } from "react";
import { checkPermission } from "@/lib/rbac";
import { ReviewService } from "@/lib/services/reviewService";
import ReviewsClient from "./ReviewsClient";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ReviewsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await checkPermission("Reviews", "canView");
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to view this page.</div>;
  }

  const searchParams = await props.searchParams;
  const pageParam = first(searchParams.page);
  const page = pageParam ? parseInt(pageParam, 10) || 1 : 1;
  const search = first(searchParams.search) || "";

  // Mirrors what ReviewsClient would otherwise request on mount for the
  // same URL — same pattern as orders/page.tsx.
  const initialData = await ReviewService.getReviews({ search, page, limit: 20 });

  // ReviewsClient uses useSearchParams() for reactive filter/page changes,
  // same reasoning OrdersClient's wrapper documents.
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        Loading reviews...
      </div>
    }>
      <ReviewsClient initialData={initialData} />
    </Suspense>
  );
}
