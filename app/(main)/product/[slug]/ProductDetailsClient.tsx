"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { useCart } from "@/store/useCart";
import { Check, ShoppingCart, Truck, ShieldCheck, Play, ArrowLeft, Minus, Plus, Star, Loader2, User, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { format } from "date-fns";
import ProductCommentsClient from "@/components/storefront/ProductCommentsClient";
import { FaYoutube } from "react-icons/fa";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

function getYouTubeEmbedUrl(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  const videoId = match && match[2].length === 11 ? match[2] : null;
  // controls=0 completely removes the bottom bar (Settings, CC, Volume, etc)
  // rel=0 hides related videos from other channels at the end
  // iv_load_policy=3 hides annotations
  return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=2&rel=0&iv_load_policy=3&modestbranding=1` : null;
}

type ImageWithMedia = {
  id: string;
  isPrimary: boolean;
  mediaFile: {
    url: string;
    fileType: string;
    name: string | null;
  };
};

type Variant = {
  id: string;
  price: number;
  stock: number;
  sku: string;
  attributes: Record<string, string> | null;
};

type ProductOption = {
  name: string;
  values: string[];
};

type RelatedProduct = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  isFeatured: boolean;
  category: { slug: string; name: string };
  images: ImageWithMedia[];
  variants: Variant[];
};

type ReviewWithUser = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string | Date;
  user: { name: string | null };
};

type ProductProp = {
  id: string;
  name: string;
  brand: string;
  description: string;
  isFeatured: boolean;
  category: { slug: string; name: string };
  images: ImageWithMedia[];
  options: ProductOption[] | null;
  variants: Variant[];
  youtubeUrls: string[];
};

export default function ProductDetailsClient({
  product,
  reviews = [],
  canReview = false,
  relatedProducts = []
}: {
  product: ProductProp,
  reviews?: ReviewWithUser[],
  canReview?: boolean,
  relatedProducts?: RelatedProduct[]
}) {
  const { addItem } = useCart();

  // Sort images so primary is first, or fallback to first uploaded
  const sortedImages = useMemo(() => {
    const arr = [...product.images];
    return arr.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return 0;
    });
  }, [product.images]);

  const [activeMedia, setActiveMedia] = useState<ImageWithMedia | { isYoutube: true, url: string } | null>(sortedImages[0] || null);

  // Image zoom state
  const [zoomed, setZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setZoomPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }

  // Dynamic Variant Selection State
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    if (product.variants.length > 0 && product.variants[0].attributes) {
      return product.variants[0].attributes;
    }
    return {};
  });

  const handleOptionSelect = (optionName: string, value: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [optionName]: value
    }));
  };

  const [quantity, setQuantity] = useState<number>(1);

  // Review form states
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewContent, setReviewContent] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [localReviews, setLocalReviews] = useState(reviews);
  const [localCanReview, setLocalCanReview] = useState(canReview);

  // Find the exact variant based on current selections
  const currentVariant = useMemo(() => {
    if (product.variants.length === 1) return product.variants[0];

    return product.variants.find((v: Variant) => {
      if (!v.attributes) return false;
      // Check if all selected options match this variant's attributes
      return Object.entries(selectedOptions).every(
        ([key, val]) => v.attributes![key] === val
      );
    });
  }, [product.variants, selectedOptions]);

  // Fallback to first available variant if combination is totally invalid
  const displayVariant = currentVariant || product.variants[0];

  // Reset quantity if it exceeds new variant's stock
  useEffect(() => {
    if (displayVariant && quantity > displayVariant.stock) {
      setQuantity(Math.max(1, displayVariant.stock));
    }
  }, [displayVariant, quantity]);

  const handleAddToCart = () => {
    if (!displayVariant) return;
    if (displayVariant.stock <= 0) {
      toast.error("This item is out of stock.");
      return;
    }

    const imageUrl = sortedImages[0]?.mediaFile.url || "";

    // Construct dynamic variant name
    const variantNameParts = displayVariant.attributes
      ? Object.values(displayVariant.attributes)
      : [];
    const variantName = variantNameParts.length > 0 ? variantNameParts.join(", ") : "Default";

    addItem({
      variantId: displayVariant.id,
      productId: product.id,
      name: product.name,
      variantName: variantName,
      price: displayVariant.price,
      image: imageUrl,
      stock: displayVariant.stock,
      quantity: quantity,
    });

    toast.success(`Added ${quantity} item(s) to cart!`);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewContent.trim()) {
      toast.error("Please enter a review.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          rating,
          title: reviewTitle,
          content: reviewContent
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit review");
      }

      toast.success("Thank you! Your review has been submitted.");
      setLocalCanReview(false);

      // Optimistically add to list
      setLocalReviews([
        {
          id: data.review.id,
          rating,
          title: reviewTitle,
          body: reviewContent,
          createdAt: new Date().toISOString(),
          user: { name: "You" }
        },
        ...localReviews
      ]);

    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Error submitting review");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 sm:py-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <Link href="/store" className="hover:text-foreground transition-colors">Store</Link>
        <span>/</span>
        <span className="text-muted-foreground truncate max-w-[200px]">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 xl:gap-16">

        {/* Left Column: Image/Video Gallery */}
        <div className="lg:col-span-5 flex flex-col-reverse lg:flex-row gap-4 h-fit static lg:sticky lg:top-24 z-10">
          {/* Thumbnail Strip */}
          <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto lg:max-h-[600px] no-scrollbar pb-2 lg:pb-0 w-full lg:w-20 flex-shrink-0">
            {sortedImages.map((img: ImageWithMedia, idx: number) => {
              const isActive = activeMedia && !("isYoutube" in activeMedia) && activeMedia?.id === img.id;
              const isVideo = img.mediaFile.fileType === "video";

              return (
                <button
                  key={img.id}
                  onClick={() => setActiveMedia(img)}
                  className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 bg-black ${isActive ? "border-primary ring-2 ring-blue-500/20" : "border-border hover:border-muted-foreground"
                    }`}
                >
                  {isVideo ? (
                    <div className="w-full h-full flex items-center justify-center bg-muted relative">
                      <video src={img.mediaFile.url} className="w-full h-full object-cover opacity-60" />
                      <Play className="absolute text-foreground w-6 h-6 drop-shadow-lg" fill="currentColor" />
                    </div>
                  ) : (
                    <Image
                      src={img.mediaFile.url}
                      alt={`Thumbnail ${idx}`}
                      fill
                      sizes="80px"
                      className="object-contain"
                    />
                  )}
                </button>
              );
            })}

            {product.youtubeUrls?.map((url, idx) => {
              const isActive = activeMedia && "isYoutube" in activeMedia && activeMedia.url === url;
              return (
                <button
                  key={`yt-${idx}`}
                  onClick={() => setActiveMedia({ isYoutube: true, url })}
                  className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 bg-red-500/10 ${isActive ? "border-red-500 ring-2 ring-red-500/20" : "border-border hover:border-red-500/50"
                    }`}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <FaYoutube className="text-red-500 w-8 h-8" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Main Display */}
          <div
            className="relative w-full aspect-square lg:aspect-[4/5] bg-card rounded-3xl overflow-hidden border border-border/60 shadow-2xl flex items-center justify-center"
            onMouseEnter={() => activeMedia && !("isYoutube" in activeMedia) && activeMedia.mediaFile.fileType !== "video" && setZoomed(true)}
            onMouseLeave={() => setZoomed(false)}
            onMouseMove={handleMouseMove}
            style={{ cursor: activeMedia && !("isYoutube" in activeMedia) && activeMedia.mediaFile.fileType !== "video" ? (zoomed ? "zoom-out" : "zoom-in") : "default" }}
          >
            {activeMedia ? (
              "isYoutube" in activeMedia ? (
                <div className="w-full h-full">
                  {getYouTubeEmbedUrl(activeMedia.url) ? (
                    <iframe
                      width="100%"
                      height="100%"
                      src={getYouTubeEmbedUrl(activeMedia.url)!}
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    ></iframe>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-muted">
                      Invalid YouTube URL
                    </div>
                  )}
                </div>
              ) : activeMedia.mediaFile.fileType === "video" ? (
                <video
                  src={activeMedia.mediaFile.url}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <Image
                  src={activeMedia.mediaFile.url}
                  alt={product.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-contain transition-transform duration-100 ease-out"
                  style={{
                    transform: zoomed ? "scale(2.2)" : "scale(1)",
                    transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                  }}
                  priority
                />
              )
            ) : (
              <div className="text-muted-foreground font-medium">No Image Available</div>
            )}

            {/* Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              {product.isFeatured && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg">
                  Featured
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Product Details */}
        <div className="lg:col-span-7 flex flex-col space-y-8">
          <div className="space-y-4">
            <div className="text-primary font-semibold tracking-wide text-sm uppercase">
              {product.brand}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
              {product.name}
            </h1>

            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold text-foreground">
                ৳{displayVariant.price.toLocaleString()}
              </div>
              {displayVariant.stock > 0 ? (
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  In Stock ({displayVariant.stock})
                </span>
              ) : (
                <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold px-3 py-1 rounded-full">
                  Out of Stock
                </span>
              )}
            </div>
          </div>

          <div className="h-px bg-muted w-full" />

          {/* Dynamic Options Selectors */}
          <div className="space-y-6">
            {product.options && product.options.map((option) => (
              <div key={option.name} className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">
                  {option.name}: <span className="text-foreground font-semibold">{selectedOptions[option.name]}</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {option.values.map(val => {
                    // Check if this specific option value is completely out of stock across all variants
                    const matchingVariants = product.variants.filter(v => v.attributes?.[option.name] === val);
                    const isOut = matchingVariants.length > 0 && matchingVariants.every(v => v.stock <= 0);
                    const isSelected = selectedOptions[option.name] === val;

                    return (
                      <button
                        key={val}
                        onClick={() => handleOptionSelect(option.name, val)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${isSelected
                          ? "border-primary bg-primary/10 text-foreground"
                          : isOut
                            ? "border-border/50 text-muted-foreground bg-transparent line-through decoration-slate-600"
                            : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground bg-card"
                          }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Action */}
          <div className="pt-4 flex flex-col sm:flex-row gap-4">

            {/* Quantity Selector */}
            <div className="flex items-center justify-between border-2 border-border bg-card rounded-2xl p-2 w-full sm:w-32 flex-shrink-0">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="text-foreground font-semibold w-6 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(q => Math.min(displayVariant.stock, q + 1))}
                disabled={quantity >= displayVariant.stock}
                className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={displayVariant.stock <= 0}
              className="flex-1 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground text-sm font-semibold py-1 rounded-xl flex items-center justify-center gap-1 transition-all active:scale-[0.98] shadow-[0_0_40px_rgba(37,99,235,0.2)] disabled:shadow-none"
            >
              <ShoppingCart className="w-5 h-5" />
              {displayVariant.stock > 0 ? "Add to Cart" : "Out of Stock"}
            </button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-4 py-6 border-y border-border text-muted-foreground text-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <span>Free delivery on orders over ৳5000</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <span>1 Year Official Warranty</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-foreground">Product Description</h3>
            <div
              className="prose dark:prose-invert  max-w-none prose-p:leading-relaxed prose-p:text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
            />
          </div>
        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts && relatedProducts.length > 0 && (
        <div className="mt-16 lg:mt-24 border-t border-border pt-12">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">You Might Also Like</h2>
            <Link
              href={`/store/category/${product.category.slug}`}
              className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              View more from {product.category.name} <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-8">
            {relatedProducts.map((relatedProd) => {
              const primaryImage = relatedProd.images[0]?.mediaFile.url || null;
              const startingPrice = relatedProd.variants[0]?.price;

              return (
                <Link
                  href={`/product/${relatedProd.slug}`}
                  key={relatedProd.id}
                  className="group flex flex-col bg-card border border-border/60 rounded-2xl p-3 sm:p-5 hover:border-primary/50 transition-colors"
                >
                  <div className="aspect-square w-full rounded-xl bg-background flex items-center justify-center mb-4 sm:mb-6 overflow-hidden relative">
                    {primaryImage ? (
                      <Image
                        src={primaryImage}
                        alt={relatedProd.name}
                        fill
                        sizes="(max-width: 640px) 50vw, 25vw"
                        className="object-contain p-2 sm:p-4 group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="text-muted-foreground text-xs">No Image</div>
                    )}
                    {relatedProd.isFeatured && (
                      <span className="absolute top-2 sm:top-3 left-2 sm:left-3 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full">
                        Featured
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col flex-grow">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] sm:text-xs text-muted-foreground">{relatedProd.brand}</span>
                      <span className="text-[8px] sm:text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{relatedProd.category.name}</span>
                    </div>
                    <h3 className="text-sm sm:text-base font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {relatedProd.name}
                    </h3>

                    <div className="mt-auto pt-2 sm:pt-4 flex items-center justify-between">
                      <div className="text-base sm:text-lg font-bold text-foreground">
                        {startingPrice ? `৳${Number(startingPrice).toFixed(2)}` : 'TBA'}
                      </div>
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary transition-colors">
                        <ArrowRight size={12} className="text-foreground sm:w-[14px] sm:h-[14px]" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {/* Reviews Section */}
      <div className="mt-16 lg:mt-24 border-t border-border pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Customer Reviews</h2>
              <div className="flex items-center gap-3">
                <div className="flex gap-0.5 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={18} fill={
                      localReviews.length > 0 && i < Math.round(localReviews.reduce((acc: number, r: ReviewWithUser) => acc + r.rating, 0) / localReviews.length)
                        ? "currentColor" : "none"
                    } className={
                      localReviews.length > 0 && i < Math.round(localReviews.reduce((acc: number, r: ReviewWithUser) => acc + r.rating, 0) / localReviews.length)
                        ? "text-amber-500" : "text-muted-foreground"
                    } />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {localReviews.length > 0
                    ? `Based on ${localReviews.length} review${localReviews.length === 1 ? '' : 's'}`
                    : "No reviews yet"}
                </span>
              </div>
            </div>

            {localCanReview && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-lg font-bold text-foreground mb-4">Write a Review</h3>
                <form onSubmit={handleSubmitReview} className="space-y-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-2 uppercase tracking-wider">Rating</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="p-1 transition-colors"
                        >
                          <Star
                            size={24}
                            fill={star <= rating ? "currentColor" : "none"}
                            className={star <= rating ? "text-amber-500" : "text-muted-foreground hover:text-muted-foreground"}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-muted-foreground mb-2 uppercase tracking-wider">Title (Optional)</label>
                    <input
                      type="text"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      placeholder="Summary of your experience"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-muted-foreground mb-2 uppercase tracking-wider">Review</label>
                    <textarea
                      required
                      value={reviewContent}
                      onChange={(e) => setReviewContent(e.target.value)}
                      placeholder="What did you like or dislike?"
                      className="w-full h-32 bg-background border border-border rounded-lg p-4 text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    {isSubmittingReview && <Loader2 size={16} className="animate-spin" />}
                    Submit Review
                  </button>
                </form>
              </div>
            )}

            {!localCanReview && (
              <div className="bg-card/50 border border-border/50 rounded-2xl p-5 text-sm text-muted-foreground flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p>
                  Only logged-in customers who have purchased and received this item can leave a review. This guarantees 100% verified authentic reviews.
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            {localReviews.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
                <Star className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p>Be the first to review this product!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {localReviews.map((review: ReviewWithUser) => (
                  <div key={review.id} className="border-b border-border/50 pb-6 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-muted-foreground shrink-0">
                          <User size={18} />
                        </div>
                        <div>
                          <div className="font-medium text-foreground flex items-center gap-2">
                            {review.user.name}
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider font-bold border border-primary/20">
                              Verified
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(review.createdAt), "MMMM d, yyyy")}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            fill={i < review.rating ? "currentColor" : "none"}
                            className={i < review.rating ? "text-amber-500" : "text-muted-foreground"}
                          />
                        ))}
                      </div>
                    </div>
                    {review.title && (
                      <h4 className="font-semibold text-foreground mb-2 text-sm">{review.title}</h4>
                    )}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {review.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Q&A / Comments Section */}
      <ProductCommentsClient productId={product.id} />

    </div>
  );
}
