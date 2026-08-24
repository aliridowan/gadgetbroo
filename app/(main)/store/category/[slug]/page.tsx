import Link from "next/link";
import prisma from "@/lib/prisma";
import { ArrowRight, Search, SlidersHorizontal, Tag } from "lucide-react";
import StoreSearch from "@/components/storefront/StoreSearch";
import { safeQuery } from "@/lib/safe-query";
import StoreSidebarClient from "@/components/storefront/StoreSidebarClient";
import URLPagination from "@/components/URLPagination";
import { notFound } from "next/navigation";

// No revalidate export here — this page reads searchParams below, which
// forces dynamic rendering regardless of any revalidate value, so a
// time-based ISR export would never actually apply. Revisit with Cache
// Components ("use cache" + cacheTag/updateTag) once there's real
// traffic to justify it, not before.
export default async function CategoryPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const slug = params.slug;
  const searchQuery = searchParams.search as string | undefined;

  const category = await safeQuery(
    prisma.category.findUnique({
      where: { slug }
    }),
    null
  );

  if (!category) {
    notFound();
  }

  const allCategories = await safeQuery(
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
    []
  );

  const pageParam = searchParams.page as string | undefined;
  const page = pageParam ? parseInt(pageParam) : 1;
  const limit = 16;
  const skip = (page - 1) * limit;

  const whereClause: any = {
    isActive: true,
    isDeleted: false,
    categoryId: category.id,
    ...(searchQuery ? { name: { contains: searchQuery, mode: 'insensitive' } } : {})
  };

  const [products, totalProducts] = await safeQuery(
    Promise.all([
      prisma.product.findMany({
        where: whereClause,
        take: limit,
        skip: skip,
        orderBy: { createdAt: "desc" },
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
      prisma.product.count({ where: whereClause })
    ]),
    [[], 0]
  );

  const totalPages = Math.ceil((totalProducts as number) / limit);

  return (
    <div className="bg-background min-h-screen text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-12 flex flex-col md:flex-row gap-8">
        {/* Sidebar Filters */}
        <StoreSidebarClient>
          <div>
            <div className="flex items-center gap-2 text-foreground font-semibold mb-4 pb-2 border-b border-border">
              <Search size={18} />
              <h3>Search</h3>
            </div>
            <StoreSearch />
          </div>

          <div>
            <div className="flex items-center gap-2 text-foreground font-semibold mb-4 pb-2 border-b border-border">
              <SlidersHorizontal size={18} />
              <h3>Categories</h3>
            </div>
            <div className="space-y-2">
              <Link
                href={`/store${searchQuery ? `?search=${searchQuery}` : ''}`}
                className="flex items-center gap-2 text-sm transition-colors text-muted-foreground hover:text-foreground"
              >
                <Tag size={14} className="text-muted-foreground" />
                All Categories
              </Link>
              {allCategories.map(c => (
                <Link
                  key={c.id}
                  href={`/store/category/${c.slug}${searchQuery ? `?search=${searchQuery}` : ''}`}
                  className={`flex items-center gap-2 text-sm transition-colors ${slug === c.slug ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Tag size={14} className={slug === c.slug ? 'text-primary' : 'text-muted-foreground'} />
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </StoreSidebarClient>

        {/* Product Grid */}
        <div className="flex-1 space-y-12">
          {searchQuery && (
            <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-xl flex items-center justify-between">
              <span>Showing search results for: <strong>&quot;{searchQuery}&quot;</strong></span>
              <Link href={`/store/category/${slug}`} className="text-sm underline hover:text-primary/80">
                Clear Search
              </Link>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between mb-8 gap-4 border-b border-border pb-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">{category.name}</h2>
              <p className="text-muted-foreground mt-1 text-sm">{totalProducts as number} products available</p>
            </div>
          </div>

          {(products as any[]).length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-12 text-center flex flex-col items-center justify-center">
              <Search className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No products found</h3>
              <p className="text-muted-foreground text-sm mb-6">We couldn&apos;t find any products in this category.</p>
              <Link href={`/store/category/${slug}`} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors">
                Clear All Filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {(products as any[]).map((product) => {
                const primaryImage = product.images[0]?.mediaFile.url || null;
                const startingPrice = product.variants[0]?.price;
                const isOutOfStock = product.variants.every((v: any) => v.stock <= 0);

                return (
                  <Link
                    href={`/product/${product.slug}`}
                    key={product.id}
                    className="group flex flex-col bg-card border border-border/60 rounded-2xl p-3 sm:p-5 hover:border-primary/50 transition-colors relative"
                  >
                    <div className="aspect-square w-full rounded-xl bg-muted/30 flex items-center justify-center mb-4 sm:mb-6 overflow-hidden relative">
                      {primaryImage ? (
                        <img
                          src={`${primaryImage}${primaryImage.includes("?") ? "&" : "?"}tr=w-400`}
                          alt={product.name}
                          className="w-full h-full object-contain p-2 sm:p-4 group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="text-muted-foreground">No Image</div>
                      )}
                      {product.isFeatured && (
                        <span className="absolute top-2 sm:top-3 left-2 sm:left-3 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full">
                          Featured
                        </span>
                      )}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
                          <span className="bg-destructive text-destructive-foreground text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg rotate-[-12deg] shadow-xl border border-red-400/50">
                            Out of Stock
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col flex-grow">
                      <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground mb-1">
                        <span>{product.brand}</span>
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
          )}

          {totalPages > 1 && (
            <div className="mt-12">
              <URLPagination currentPage={page} totalPages={totalPages} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
