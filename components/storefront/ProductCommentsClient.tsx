"use client";

import { useState, useEffect } from "react";
import { Loader2, User, Send, Trash2, Edit2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import Link from "next/link";
import { Button } from "../ui/button";

type CommentWithUser = {
  id: string;
  body: string;
  userId: string;
  productId: string;
  isPublic: boolean;
  adminReply: string | null;
  createdAt: string;
  user: {
    name: string | null;
    email: string;
  };
};

export default function ProductCommentsClient({ productId }: { productId: string }) {
  const { user } = useAuthSession();
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    fetchComments(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, user]);

  async function fetchComments(pageToFetch: number = 1, reset: boolean = false) {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const res = await fetch(`/api/comments?productId=${productId}&page=${pageToFetch}&limit=5`);
      const data = await res.json();

      if (data.success) {
        if (reset) {
          setComments(data.data);
        } else {
          setComments(prev => [...prev, ...data.data]);
        }
        setPage(pageToFetch);
        setHasMore(data.pagination.page < data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchComments(page + 1, false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please login to comment");
      return;
    }
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, body: newComment })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Comment posted securely. It is currently private.");
        setNewComment("");
        fetchComments();
      } else {
        throw new Error(data.error);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this comment?")) return;
    try {
      const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Comment deleted");
        fetchComments();
      }
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  const handleEditSubmit = async (id: string) => {
    if (!editContent.trim()) return;
    try {
      const res = await fetch(`/api/comments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editContent })
      });
      if (res.ok) {
        toast.success("Comment updated");
        setEditingId(null);
        fetchComments();
      }
    } catch {
      toast.error("Failed to update comment");
    }
  };

  return (
    <div className="mt-16 lg:mt-24 border-t border-border pt-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

        {/* Left Side: Post Comment */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Q&A / Comments</h2>
            <p className="text-sm text-muted-foreground">
              Have a question or feedback? Leave a comment below.
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            {!user ? (
              <div className="text-center py-6">
                <ShieldAlert className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-muted-foreground font-semibold mb-2">Login Required</h3>
                <p className="text-sm text-muted-foreground mb-4">You must be logged in to post a comment securely.</p>

                <Button asChild className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors">
                  <Link href="/sign-in">
                    Login to Comment
                  </Link>
                </Button>

              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground">
                    <User size={16} />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">{user.name}</span>
                </div>

                <div>
                  <textarea
                    required
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write your comment securely..."
                    className="w-full h-24 bg-background border border-border rounded-lg p-3 text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-2">
                    * Your comment is private by default and visible only to you and store admins.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !newComment.trim()}
                  className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Post Comment
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Side: Comments List */}
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
              <p>No comments yet. Be the first to ask a question!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-card border border-border/80 rounded-2xl p-5 relative group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-muted-foreground shrink-0">
                        <User size={18} />
                      </div>
                      <div>
                        <div className="font-medium text-foreground flex items-center gap-2">
                          {comment.user.name}
                          {!comment.isPublic && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-medium border border-amber-500/20">
                              Private
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(comment.createdAt), "MMMM d, yyyy")}
                        </div>
                      </div>
                    </div>

                    {user && user.id === comment.userId && (
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingId(comment.id); setEditContent(comment.body); }}
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {editingId === comment.id ? (
                    <div className="mt-3">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-20 bg-background border border-border rounded-lg p-3 text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none mb-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditSubmit(comment.id)}
                          className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 bg-muted text-foreground text-xs font-medium rounded hover:bg-muted/80"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground leading-relaxed mt-2 whitespace-pre-wrap">
                      {comment.body}
                    </p>
                  )}

                  {comment.adminReply && (
                    <div className="mt-4 ml-6 p-4 bg-primary/10 border-l-2 border-primary rounded-r-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">Admin Reply</span>
                      </div>
                      <p className="text-sm text-primary-foreground/80 whitespace-pre-wrap">
                        {comment.adminReply}
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {hasMore && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-6 py-2 bg-muted hover:bg-muted/80 text-muted-foreground text-sm font-medium rounded-full transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loadingMore ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loadingMore ? "Loading..." : "Load More Comments"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
