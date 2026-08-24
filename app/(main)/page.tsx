import Link from "next/link";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { ArrowRight, Search } from "lucide-react";
import HeroSlider from "@/components/storefront/HeroSlider";
import { safeQuery } from "@/lib/safe-query";
import CategorySlider from "@/components/storefront/CategorySlider";
import URLPagination from "@/components/URLPagination";

// No revalidate export here — this page reads searchParams below, which
// forces dynamic rendering regardless of any revalidate value, so a
// time-based ISR export would never actually apply. See the products/
// store audit discussion: revisit with Cache Components ("use cache" +
// cacheTag/updateTag) once there's real traffic to justify it, not before.
export default async function Home(props: { searchParams?: Promise<{ page?: string }> }) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const page = searchParams.page ? parseInt(searchParams.page) : 1;
  const limit = 15;
  const skip = (page - 1) * limit;

  // safeQuery falls back to [] instead of failing the whole page (and, at
  // build time, the whole `next build`) if the DB is briefly unreachable.
  const [categories, recentProducts, totalProducts, heroBanners] = await Promise.all([
    safeQuery(
      prisma.category.findMany({
        where: { isActive: true },
        include: {
          products: {
            where: { isActive: true, isDeleted: false },
            take: 1,
            include: {
              images: {
                where: { isPrimary: true },
                include: { mediaFile: true },
                take: 1
              }
            }
          }
        },
        orderBy: { createdAt: "asc" }
      }),
      []
    ),
    safeQuery(
      prisma.product.findMany({
        where: { 
          isActive: true, 
          isDeleted: false,
          variants: { some: { isActive: true, stock: { gt: 0 } } }
        },
        take: limit,
        skip: skip,
        orderBy: { createdAt: "desc" }, // or you could use a random approach if preferred, but desc is standard for "latest" mixed
        include: {
          category: true,
          images: {
            where: { isPrimary: true },
            include: { mediaFile: true },
            take: 1
          },
          variants: {
            where: { isActive: true, isDeleted: false },
            orderBy: { price: 'asc' },
            take: 1
          }
        }
      }),
      []
    ),
    safeQuery(
      prisma.product.count({
        where: { 
          isActive: true, 
          isDeleted: false,
          variants: { some: { isActive: true, stock: { gt: 0 } } }
        },
      }),
      0
    ),
    safeQuery(
      prisma.siteMedia.findMany({
        where: { isActive: true, placement: "HERO_SLIDER" },
        orderBy: { sortOrder: "asc" }
      }),
      []
    )
  ]);
  
  const totalPages = Math.ceil((totalProducts as number) / limit);

  // Filter out categories that have NO products (or no active products)
  const validCategories = (categories as any[]).filter(c => c.products && c.products.length > 0);

  return (
    <div className="bg-background min-h-screen text-foreground selection:bg-primary/30 overflow-x-hidden">

      {/* Hero Section */}
      <section className="relative h-[45vh] md:h-[60vh] lg:h-[70vh] w-full flex items-center justify-center overflow-hidden">

        {/* The new interactive Slider handles the backgrounds and the content logic */}
        <HeroSlider banners={heroBanners.map(b => ({ id: b.id, title: b.title, url: b.url, linkUrl: b.linkUrl }))} />

        {/* Global Search Bar (Positioned at bottom of hero) */}
      </section>

      {/* Mixed Products Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-border/40">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-12 gap-4">
          <div className="text-center sm:text-left">
            <h2 className="text-3xl font-bold text-foreground tracking-tight">Latest Arrivals</h2>
            <p className="text-muted-foreground mt-2">Discover the newest technology added to our collection.</p>
          </div>
          <Link
            href="/store"
            className="bg-primary/10 border border-primary/30 text-primary font-medium px-8 py-3 rounded-full hover:bg-primary hover:text-primary-foreground transition-all duration-300 flex items-center justify-center gap-2"
          >
            Browse All Products <ArrowRight size={16} />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-8">
          {recentProducts.map((product) => {
            const primaryImage = product.images[0]?.mediaFile.url || null;
            const startingPrice = product.variants[0]?.price;

            return (
              <Link
                href={`/product/${product.slug}`}
                key={product.id}
                className="group flex flex-col bg-card border border-border/60 rounded-2xl p-3 sm:p-5 hover:border-primary/50 transition-colors"
              >
                <div className="aspect-square w-full rounded-xl bg-muted/30 flex items-center justify-center mb-4 sm:mb-6 overflow-hidden relative">
                  {primaryImage ? (
                    // next/image instead of a raw <img> — real remotePatterns
                    // are already configured for every host these come from.
                    // Also drops the old `?tr=w-400` ImageKit transform param:
                    // the storage backend migrated to Garage a while back,
                    // which doesn't understand that query param at all, so it
                    // was silently ignored and the full-resolution original
                    // was being served into this thumbnail slot regardless.
                    // next/image resizes server-side itself, so this is a
                    // strict improvement either way.
                    <Image
                      src={primaryImage}
                      alt={product.name}
                      fill
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      className="object-contain p-2 sm:p-4 group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="text-muted-foreground">No Image</div>
                  )}
                  {product.isFeatured && (
                    <span className="absolute top-2 sm:top-3 left-2 sm:left-3 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full">
                      Featured
                    </span>
                  )}
                </div>

                <div className="flex flex-col flex-grow">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] sm:text-xs text-muted-foreground">{product.brand}</span>
                    <span className="text-[8px] sm:text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{product.category.name}</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {product.name}
                  </h3>

                  <div className="mt-auto pt-2 sm:pt-4 flex items-center justify-between">
                    <div className="text-base sm:text-lg font-bold text-foreground">
                      {startingPrice ? `৳${Number(startingPrice).toFixed(2)}` : 'TBA'}
                    </div>
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary transition-colors">
                      <ArrowRight size={12} className="text-muted-foreground group-hover:text-primary-foreground sm:w-[14px] sm:h-[14px]" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="mt-8">
            <URLPagination currentPage={page} totalPages={totalPages} />
          </div>
        )}

        <div className="flex justify-center mt-12">
          <Link href="/store" className="bg-muted text-foreground font-medium px-8 py-3 rounded-full hover:bg-muted/80 transition-colors flex items-center gap-2 border border-border">
            View the full catalog <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Explore Categories - Interactive Slider AT THE BOTTOM */}
      <section className="py-20 border-t border-border/40 relative bg-muted/10">
        <div className="text-center mb-10 px-4">
          <h2 className="text-3xl font-bold text-foreground tracking-tight">Shop by Category</h2>
          <p className="text-muted-foreground mt-2">Explore our specialized collections.</p>
        </div>

        {validCategories.length > 0 ? (
          <CategorySlider categories={validCategories} />
        ) : (
          <div className="text-center py-12 text-muted-foreground bg-muted/30 mx-4 rounded-2xl border border-border/50">
            No categories available yet.
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 px-4 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} GadgetBroo. All rights reserved.</p>
      </footer>
    </div>
  );
}
