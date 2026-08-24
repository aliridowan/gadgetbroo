import prisma from "@/lib/prisma";

export type SiteMediaBanner = {
  id: string;
  title: string;
  url: string;
  fileId: string;
  placement: "HERO_SLIDER" | "PROMOTIONAL_BANNER" | "CATEGORY_BANNER";
  linkUrl: string | null;
  isActive: boolean;
  sortOrder: number;
};

/**
 * SiteMediaService — single source of truth for the admin homepage-banners
 * query. Called both by GET /api/site-media (client-side re-fetch after a
 * create/edit/delete/toggle) and directly by site-media/page.tsx (initial
 * page load), same reasoning as the other admin *Service modules.
 */
export const SiteMediaService = {
  async getBanners(): Promise<SiteMediaBanner[]> {
    return prisma.siteMedia.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        url: true,
        fileId: true,
        placement: true,
        linkUrl: true,
        isActive: true,
        sortOrder: true,
      },
    });
  },
};
