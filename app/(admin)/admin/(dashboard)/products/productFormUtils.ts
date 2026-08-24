// Shared between NewProductClient and EditProductClient — pure helpers with
// no form/network state, safe to use from either without duplicating logic
// that used to be copy-pasted (and drift-prone) across both files.
import type { ProductOption } from "@/components/admin/DynamicOptionBuilder";

export function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function generateCartesianCombinations(options: ProductOption[]): Record<string, string>[] {
  const activeOptions = options.filter((o) => o.values.length > 0);
  if (activeOptions.length === 0) return [];

  const results: Record<string, string>[] = [];
  const helper = (idx: number, currentObj: Record<string, string>) => {
    if (idx === activeOptions.length) {
      results.push({ ...currentObj });
      return;
    }
    const opt = activeOptions[idx];
    for (const val of opt.values) {
      currentObj[opt.name] = val;
      helper(idx + 1, currentObj);
    }
  };
  helper(0, {});
  return results;
}
