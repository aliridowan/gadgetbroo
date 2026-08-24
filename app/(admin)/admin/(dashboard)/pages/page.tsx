import { checkPermission } from "@/lib/rbac";
import { PageContentService } from "@/lib/services/pageContentService";
import PagesClient from "./PagesClient";

export default async function PagesPage() {
  const session = await checkPermission("Settings", "canView");
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to view this page.</div>;
  }

  // Matches PagesClient's default selection (slug="privacy-policy",
  // language="en") so the client doesn't immediately re-fetch what we
  // already rendered.
  const page = await PageContentService.getPage("privacy-policy", "en");

  return (
    <PagesClient
      initialContent={page?.content ?? ""}
      initialUpdatedAt={page ? new Date(page.updatedAt).toLocaleDateString() : null}
    />
  );
}
