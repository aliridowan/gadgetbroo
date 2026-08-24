// app/(admin)/admin/(dashboard)/settings/page.tsx
import { checkPermission } from "@/lib/rbac";
import { StoreSettingsService } from "@/lib/services/storeSettingsService";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await checkPermission("Settings", "canView");
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to view this page.</div>;
  }

  const settings = await StoreSettingsService.getSettings();

  return (
    <SettingsClient
      initialBannerUrl={settings.bannerUrl}
      initialFaviconUrl={settings.faviconUrl}
      initialContactEmail={settings.contactEmail}
      initialContactPhone={settings.contactPhone}
      initialContactAddress={settings.contactAddress}
    />
  );
}
