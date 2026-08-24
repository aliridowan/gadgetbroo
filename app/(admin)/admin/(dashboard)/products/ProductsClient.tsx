"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Plus, Search, ChevronDown, ArrowUpDown,
  List, LayoutGrid, Pencil, Trash2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DeleteProductButton } from "./HandleProductAction";
import URLPagination from "@/components/URLPagination";

import { useSearchParams, useRouter, usePathname } from "next/navigation";

type ProductFromAPI = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  isActive: boolean;
  isFeatured: boolean;
  category: { name: string; slug: string };
  images: { mediaFile: { url: string; name: string | null } }[];
  lowestPrice: number;
  totalStock: number;
  stockStatus: "in" | "low" | "out";
  _count: { variants: number; images: number };
};

type Category = { id: string; name: string };

// Single source of truth for each filter's "unset" value — matches
// page.tsx's server-side defaults exactly, so the initial client render
// (derived from the URL) always agrees with what the server already fetched.
// A filter at its default is omitted from the URL entirely, keeping shared
// links minimal (e.g. `?stock=out` instead of every key spelled out).
const FILTER_DEFAULTS: Record<string, string> = {
  search: "",
  categoryId: "",
  featured: "",
  stock: "all",
  sortBy: "createdAt",
  sortDir: "desc",
};

export default function ProductsClient({
  initialProducts,
  initialTotalPages,
  initialCategories,
}: {
  initialProducts: ProductFromAPI[];
  initialTotalPages: number;
  initialCategories: Category[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [products, setProducts] = useState<ProductFromAPI[]>(initialProducts);
  const [categories] = useState<Category[]>(initialCategories);
  const [loading, setLoading] = useState(false);

  // All filters — including page — are URL-driven so a pasted link (or the
  // browser's back/forward) reproduces exactly what's currently on screen
  // for anyone who opens it, not just the person who set the filters.
  const page = Number(searchParams.get("page")) || 1;
  const search = searchParams.get("search") ?? FILTER_DEFAULTS.search;
  const categoryId = searchParams.get("categoryId") ?? FILTER_DEFAULTS.categoryId;
  const featured = searchParams.get("featured") ?? FILTER_DEFAULTS.featured;
  const activeTab = (searchParams.get("stock") ?? FILTER_DEFAULTS.stock) as "all" | "in" | "low" | "out";
  const sortBy = searchParams.get("sortBy") ?? FILTER_DEFAULTS.sortBy;
  const sortDir = (searchParams.get("sortDir") ?? FILTER_DEFAULTS.sortDir) as "asc" | "desc";

  // Purely a display preference — doesn't change which products are
  // returned, so (unlike the filters above) it stays local instead of
  // cluttering the URL.
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const [totalPages, setTotalPages] = useState(initialTotalPages);

  // Push a filter change into the URL (dropping the key entirely when it's
  // back to its default) and reset to page 1, since the previous page
  // number may no longer make sense under the new filter.
  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== FILTER_DEFAULTS[key]) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.replace(`${pathname}?${params.toString()}`);
  };

  // Local echo of the search box so typing feels instant — pushed to the
  // URL (and re-fetched) only after the user pauses, instead of on every
  // keystroke. Seeded once from the URL on mount; a fresh pasted link (or a
  // full navigation to this page) always re-mounts this component, so that's
  // the only time this needs to reflect `search` — no extra effect needed to
  // re-sync it against later same-page URL changes.
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== search) updateFilter("search", searchInput);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryId) params.set("categoryId", categoryId);
      if (featured) params.set("featured", featured);
      if (activeTab !== "all") params.set("stock", activeTab);
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      params.set("page", page.toString());
      params.set("limit", "15");

      const res = await fetch(`/api/products?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();

      if (Array.isArray(data)) {
         setProducts(data);
      } else {
         setProducts(data.products || []);
         setTotalPages(data.totalPages || 1);
      }
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, featured, activeTab, sortBy, sortDir, page]);

  // The server already fetched data matching the defaults above (page=<from
  // URL>, search="", categoryId="", featured="", stock="all",
  // sortBy="createdAt", sortDir="desc"), so skip the very first effect run —
  // it would just re-request the exact same page.
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    fetchProducts();
  }, [fetchProducts]);

  const StockBadge = ({ status, count }: { status: string; count: number }) => {
    if (status === "out") return <span className="text-destructive font-medium text-xs">Out of Stock</span>;
    if (status === "low") return (
      <span className="bg-amber-500/20 text-amber-500 text-xs font-medium px-2.5 py-1 rounded-full border border-amber-500/30">
        Low ({count})
      </span>
    );
    return <span className="text-emerald-400 text-xs font-medium">In Stock ({count})</span>;
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Products
            <span className="text-muted-foreground text-base font-normal">({products.length})</span>
          </h1>
          <Link href="/admin/products/new">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </Link>
        </div>

        <div className="bg-card/90 border border-border rounded-xl p-4 sm:p-6 space-y-6 shadow-2xl backdrop-blur-md">

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name or slug..."
                className="w-full bg-background border border-border text-foreground text-sm rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-border transition-colors placeholder:text-muted-foreground"
              />
            </div>

            <div className="relative min-w-[150px]">
              <select
                value={categoryId}
                onChange={(e) => updateFilter('categoryId', e.target.value)}
                className="w-full bg-background border border-border text-foreground text-sm rounded-lg px-3 py-2.5 pr-8 appearance-none outline-none focus:border-border cursor-pointer"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>

            <div className="relative min-w-[140px]">
              <select
                value={featured}
                onChange={(e) => updateFilter('featured', e.target.value)}
                className="w-full bg-background border border-border text-foreground text-sm rounded-lg px-3 py-2.5 pr-8 appearance-none outline-none focus:border-border cursor-pointer"
              >
                <option value="">All Products</option>
                <option value="true">Featured</option>
                <option value="false">Non Featured</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>

            <div className="relative min-w-[140px]">
              <select
                value={sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value)}
                className="w-full bg-background border border-border text-foreground text-sm rounded-lg px-3 py-2.5 pr-8 appearance-none outline-none focus:border-border cursor-pointer"
              >
                <option value="createdAt">Sort: Date Added</option>
                <option value="name">Sort: Name</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>

            <button
              onClick={() => updateFilter('sortDir', sortDir === "asc" ? "desc" : "asc")}
              className="bg-background border border-border text-muted-foreground hover:bg-muted text-sm px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="capitalize">{sortDir}</span>
            </button>
          </div>

          {/* Tabs + View Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-6 text-sm">
              {(["all", "in", "low", "out"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => updateFilter('stock', tab)}
                  className={`transition-colors font-medium ${activeTab === tab ? "text-sky-400" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {tab === "all" ? "All" : tab === "in" ? "In Stock" : tab === "low" ? "Low Stock (≤5)" : "Out of Stock"}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-background border border-border rounded-lg p-0.5 self-start sm:self-auto">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-muted-foreground" size={24} />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-sm">No products found.</p>
              <Link href="/admin/products/new" className="text-sky-400 hover:text-sky-300 text-sm mt-2 inline-block">
                Add your first product →
              </Link>
            </div>
          ) : viewMode === "list" ? (

            /* List View */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-muted-foreground text-sm font-medium border-b border-border">
                    <th className="py-3 px-4 font-normal">Product</th>
                    <th className="py-3 px-4 font-normal">Category</th>
                    <th className="py-3 px-4 font-normal">Price</th>
                    <th className="py-3 px-4 font-normal">Stock</th>
                    <th className="py-3 px-4 font-normal">Featured</th>
                    <th className="py-3 px-4 font-normal">Status</th>
                    <th className="py-3 px-4 font-normal text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-muted transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-muted rounded-md border border-border flex-shrink-0 overflow-hidden">
                            {product.images[0] ? (
                              <Image
                                src={`${product.images[0]?.mediaFile?.url}${product.images[0]?.mediaFile?.url.includes("?") ? "&" : "?"}tr=w-100`}
                                alt={product.images[0]?.mediaFile?.name ?? product.name}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted" />
                            )}
                          </div>
                          <div className="max-w-[240px]">
                            <div className="font-semibold text-slate-100 truncate">{product.name}</div>
                            <div className="text-muted-foreground text-xs truncate mt-0.5">{product.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-muted-foreground">{product.category.name}</td>
                      <td className="py-4 px-4 text-foreground font-medium">৳{product.lowestPrice.toLocaleString()}</td>
                      <td className="py-4 px-4">
                        <StockBadge status={product.stockStatus} count={product.totalStock} />
                      </td>
                      <td className="py-4 px-4 text-muted-foreground">
                        {product.isFeatured ? (
                          <span className="text-amber-400 text-xs font-medium">Yes</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">No</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${product.isActive
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                          }`}>
                          {product.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/admin/products/${product.id}/edit`}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                          {/* <button className="text-muted-foreground hover:text-destructive transition-colors p-1"> */}
                          {/*   <Trash2 className="w-4 h-4" /> */}
                          {/* </button> */}
                          <DeleteProductButton
                            product={product}
                            onSuccess={fetchProducts}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          ) : (

            /* Grid View */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <div key={product.id} className="bg-muted border border-border rounded-xl overflow-hidden hover:border-slate-600/60 transition-colors">
                  <div className="aspect-square bg-muted relative">
                    {product.images[0] ? (
                      <Image
                        src={`${product.images[0]?.mediaFile?.url}${product.images[0]?.mediaFile?.url.includes("?") ? "&" : "?"}tr=w-400`}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">No image</div>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="font-semibold text-slate-100 text-sm truncate">{product.name}</div>
                    <div className="text-muted-foreground text-xs">{product.category.name}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground text-sm font-medium">৳{product.lowestPrice.toLocaleString()}</span>
                      <StockBadge status={product.stockStatus} count={product.totalStock} />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Link href={`/admin/products/${product.id}/edit`} className="text-muted-foreground hover:text-foreground p-1">
                        <Pencil className="w-3.5 h-3.5" />
                      </Link>
                      <button className="text-muted-foreground hover:text-destructive p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <URLPagination currentPage={page} totalPages={totalPages} />
          )}
        </div>
      </div>
    </div>
  );
}
