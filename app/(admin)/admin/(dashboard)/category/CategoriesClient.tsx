// app/(admin)/admin/(dashboard)/category/CategoriesClient.tsx
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  CreateCategoryButton,
  EditCategoryButton,
  DeleteCategoryButton,
  CategoryData,
} from "./HandleCategoryAction";

export default function CategoriesClient({
  initialCategories,
}: {
  initialCategories: CategoryData[];
}) {
  const [categories, setCategories] = useState<CategoryData[]>(initialCategories);
  const [loading, setLoading] = useState(false);

  // Re-fetch after create/edit/delete — the server only supplies the
  // initial page load, mutations still refresh via the API route.
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-secondary-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Categories
          </h1>
          <CreateCategoryButton onSuccess={fetchCategories} />
        </div>

        <div className="bg-card/80 border border-border rounded-xl overflow-hidden shadow-xl backdrop-blur-sm">

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-muted-foreground text-sm font-medium border-b border-border">
                  <th className="py-4 px-6">Name</th>
                  <th className="py-4 px-6">Slug</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Products</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted-foreground">
                      No categories yet.
                    </td>
                  </tr>
                ) : categories.map((category) => (
                  <tr key={category.id} className="hover:bg-muted/50 transition-colors">
                    <td className="py-4 px-6 font-medium text-foreground">{category.name}</td>
                    <td className="py-4 px-6 text-muted-foreground font-mono text-xs">{category.slug}</td>
                    <td className="py-4 px-6">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${category.isActive
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-secondary text-secondary-foreground border border-secondary-foreground/20"
                        }`}>
                        {category.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-muted-foreground">{category._count.products}</td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <EditCategoryButton category={category} onSuccess={fetchCategories} />
                        <DeleteCategoryButton category={category} onSuccess={fetchCategories} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="block md:hidden divide-y divide-border">
            {categories.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground text-sm">No categories yet.</p>
            ) : categories.map((category) => (
              <div key={category.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{category.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{category.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <EditCategoryButton category={category} onSuccess={fetchCategories} />
                    <DeleteCategoryButton category={category} onSuccess={fetchCategories} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                  <span className={`px-2 py-0.5 rounded font-medium ${category.isActive
                      ? "bg-green-500/10 text-green-400"
                      : "bg-secondary text-secondary-foreground"
                    }`}>
                    {category.isActive ? "Active" : "Inactive"}
                  </span>
                  <span>Products: <strong className="text-foreground">{category._count.products}</strong></span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
