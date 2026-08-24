// app/(admin)/admin/(dashboard)/category/page.tsx
import { checkPermission } from "@/lib/rbac";
import { CategoryService } from "@/lib/services/categoryService";
import CategoriesClient from "./CategoriesClient";

export default async function CategoriesPage() {
  const session = await checkPermission("Categories", "canView");
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to view this page.</div>;
  }

  // Matches the client's default fetch (no page/limit params → page=1, limit=10).
  const { categories } = await CategoryService.getCategories();

  return <CategoriesClient initialCategories={categories} />;
}
