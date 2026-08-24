// app/(admin)/admin/(dashboard)/products/new/page.tsx
import { checkPermission } from "@/lib/rbac";
import { CategoryService } from "@/lib/services/categoryService";
import NewProductClient from "./NewProductClient";

export default async function NewProductPage() {
  // The layout only gates whether you're let into /admin at all (any
  // permission on any resource) — this is the resource-specific gate,
  // matching what POST /api/products already enforces on submit. Without
  // it, someone with permissions on an unrelated resource could still load
  // and fill out this form, only to hit a 403 when they tried to save.
  const session = await checkPermission("Products", "canCreate");
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to create products.</div>;
  }

  // Matches the client's original `fetch("/api/categories")` call — no
  // params, so CategoryService's own default limit (10) applies here too.
  const { categories } = await CategoryService.getCategories();

  return <NewProductClient initialCategories={categories} />;
}
