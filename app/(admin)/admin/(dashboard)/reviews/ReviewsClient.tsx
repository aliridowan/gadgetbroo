"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Star, Loader2, FileText, Search, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import URLPagination from "@/components/URLPagination";
import { useAuthSession, hasPermission } from "@/components/auth/AuthSessionProvider";
import type { ReviewListResult } from "@/lib/services/reviewService";

interface ReviewsClientProps {
  initialData: ReviewListResult;
}

export default function ReviewsClient({ initialData }: ReviewsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const page = parseInt(sp.get("page") ?? "1");
  const search = sp.get("search") ?? "";

  const { fullUser } = useAuthSession();
  const isAdmin = fullUser?.role?.name?.toLowerCase() === "admin";
  const canUpdate = isAdmin || hasPermission(fullUser?.role?.permissions, "Reviews", "canUpdate");
  const canDelete = isAdmin || hasPermission(fullUser?.role?.permissions, "Reviews", "canDelete");

  const [data, setData] = useState<ReviewListResult>(initialData);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function push(params: Record<string, string>) {
    const next = new URLSearchParams(sp.toString());
    Object.entries(params).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  }

  function handleSearchChange(v: string) {
    setSearchInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push({ search: v }), 400);
  }

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/reviews?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      const result = await res.json();
      setData(result);
    } catch (error) {
      toast.error("Could not load reviews");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  // The server already fetched data matching the URL's current page/search
  // (see reviews/page.tsx), so skip the very first effect run.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    fetchReviews();
  }, [fetchReviews]);

  const toggleVisibility = async (id: string, currentIsVisible: boolean) => {
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVisible: !currentIsVisible }),
      });
      if (!res.ok) throw new Error("Failed to update visibility");
      toast.success(currentIsVisible ? "Review hidden" : "Review published");
      setData((prev) => ({
        ...prev,
        reviews: prev.reviews.map((r) => (r.id === id ? { ...r, isVisible: !currentIsVisible } : r)),
      }));
    } catch (error) {
      toast.error("Failed to update review");
    }
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Are you sure you want to delete this review?")) return;
    try {
      const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete review");
      toast.success("Review deleted");
      setData((prev) => ({
        ...prev,
        reviews: prev.reviews.filter((r) => r.id !== id),
        total: prev.total - 1,
      }));
    } catch (error) {
      toast.error("Failed to delete review");
    }
  };

  const reviews = data.reviews;

  return (
    <div className="space-y-6 max-w-7xl mx-auto mt-2">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Star className="text-amber-500" />
            Reviews
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Moderate customer product reviews
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder="Search reviews..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 bg-card border-border text-foreground"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead className="border-b border-border text-muted-foreground text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Rating</th>
                <th className="px-5 py-3.5 min-w-[200px]">Review</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              {loading && reviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Loader2 className="animate-spin text-muted-foreground mx-auto" size={24} />
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">
                    <FileText size={32} className="opacity-40 mx-auto mb-3" />
                    <p className="text-sm">No reviews found</p>
                  </td>
                </tr>
              ) : (
                reviews.map((review) => (
                  <tr key={review.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 font-medium text-foreground truncate max-w-[150px]" title={review.product.name}>
                      {review.product.name}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">{review.user.name}</div>
                      <div className="text-muted-foreground mt-0.5 truncate max-w-[120px]">{review.user.email}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-0.5 text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={12} fill={i < review.rating ? "currentColor" : "none"} className={i < review.rating ? "text-amber-500" : "text-slate-700"} />
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-muted-foreground">{review.title}</div>
                      <div className="text-muted-foreground mt-1 line-clamp-2" title={review.body || ""}>
                        {review.body}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {format(new Date(review.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                        review.isVisible ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-muted-foreground bg-slate-400/10 border-slate-400/20'
                      }`}>
                        {review.isVisible ? "Published" : "Hidden"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleVisibility(review.id, review.isVisible)}
                          disabled={!canUpdate}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          title={!canUpdate ? "You don't have permission to update reviews" : (review.isVisible ? "Hide Review" : "Publish Review")}
                        >
                          {review.isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                          onClick={() => deleteReview(review.id)}
                          disabled={!canDelete}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-red-500/10 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          title={!canDelete ? "You don't have permission to delete reviews" : "Delete"}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <URLPagination currentPage={data.page} totalPages={data.totalPages} />
    </div>
  );
}
