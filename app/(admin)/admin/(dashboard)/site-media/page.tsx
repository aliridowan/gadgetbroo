import { requireAdmin } from "@/lib/rbac";
import { SiteMediaService } from "@/lib/services/siteMediaService";
import SiteMediaClient from "./SiteMediaClient";

export default async function SiteMediaAdminPage() {
  // Matches the API route's own gate — site-media is admin-role-only
  // (requireAdmin), not resource-permission-gated like most other pages.
  const session = await requireAdmin();
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to view this page.</div>;
  }

  const banners = await SiteMediaService.getBanners();

  return <SiteMediaClient initialBanners={banners} />;
}
