import { ImageResponse } from "next/og";
import { StoreSettingsService } from "@/lib/services/storeSettingsService";

// This is a Route Handler (per Next's app-icons convention), and by
// default generated icons are statically optimized — rendered once at
// build time and cached. That would silently defeat the whole point:
// an admin uploads a new favicon via /admin/settings, saves, and the
// browser tab wouldn't reflect it until the next deploy. force-dynamic
// makes every request re-read StoreSettings and re-fetch the current
// CDN image, so a save shows up on the very next tab load.
export const dynamic = "force-dynamic";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const settings = await StoreSettingsService.getSettings();

  // No favicon uploaded yet — fall back to the same "GB" monogram the
  // storefront already uses elsewhere (MobileNav / Footer) when there's
  // no bannerUrl, so there's still a branded icon instead of a blank/
  // broken one.
  if (!settings.faviconUrl) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0a0a0a",
            color: "white",
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          GB
        </div>
      ),
      { ...size }
    );
  }

  // faviconUrl is an arbitrary uploaded image (could be a non-square
  // product photo) — object-fit: cover on a fixed square container
  // center-crops it into a proper favicon instead of squishing it.
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={settings.faviconUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    ),
    { ...size }
  );
}
