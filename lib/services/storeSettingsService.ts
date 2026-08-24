import prisma from "@/lib/prisma";
import type { StoreSettings } from "@/src/generated/prisma/client";
import type { StoreSettingsInput } from "@/zodSchemas/storeSettingsSchema";

/**
 * StoreSettingsService — single source of truth for the site-wide
 * StoreSettings singleton row (id: "global"): banner/favicon + contact
 * info shown on the storefront. Called by GET/POST /api/settings (the
 * admin Settings page's load/save) and directly by settings/page.tsx
 * (initial page load), same reasoning as the other admin *Service
 * modules. Footer.tsx and navbar.tsx intentionally do NOT go through
 * this service — they're storefront-wide server components with their
 * own direct, unguarded prisma.storeSettings.findUnique() reads and a
 * hardcoded fallback if the row is missing; that's pre-existing and out
 * of scope here.
 */
export const StoreSettingsService = {
  /**
   * Same lazy-create-with-defaults behavior the GET handler always had:
   * the "global" row is expected to exist (seeded in prisma/seed.ts), but
   * if it's ever missing this creates it with the seed defaults instead
   * of returning null.
   */
  async getSettings(): Promise<StoreSettings> {
    let settings = await prisma.storeSettings.findUnique({
      where: { id: "global" },
    });

    if (!settings) {
      settings = await prisma.storeSettings.create({
        data: {
          id: "global",
          contactEmail: "mahamudul.dev@gmail.com",
          contactPhone: "+8801881835612",
          contactAddress: "Brothers Computer Zone, Sachibunia Bazar, Lobonchora,\nKhulna",
        },
      });
    }

    return settings;
  },

  async saveSettings(data: StoreSettingsInput): Promise<StoreSettings> {
    return prisma.storeSettings.upsert({
      where: { id: "global" },
      update: data,
      create: { id: "global", ...data },
    });
  },
};
