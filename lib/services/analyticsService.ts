import prisma from "@/lib/prisma";
import { Prisma } from "@/src/generated/prisma/client";

export type CountriesAnalyticsParams = {
  range?: string; // "today" | "7d" | "30d" | "all"
  page?: number;
  limit?: number;
  sortBy?: string; // "views" | "country"
  sortOrder?: string; // "asc" | "desc"
  search?: string;
};

export type CountriesAnalyticsResult = {
  data: { country: string; views: number }[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type PagesAnalyticsParams = {
  range?: string; // "today" | "7d" | "30d" | "all"
  page?: number;
  limit?: number;
  sortBy?: string; // "views" | "page"
  sortOrder?: string; // "asc" | "desc"
  search?: string;
};

export type PagesAnalyticsResult = {
  data: { page: string; views: number }[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type VisitorsAnalyticsParams = {
  range?: string; // "today" | "7d" | "30d" | "all"
  page?: number;
  limit?: number;
  sortBy?: string; // "lastSeen" | "pageCount" | "country"
  sortOrder?: string; // "asc" | "desc"
  country?: string;
  device?: string;
  events?: string; // "cart" | "checkout" | "both" | "none"
};

export type VisitorData = {
  sessionId: string;
  ip: string;
  country: string;
  city: string;
  device: string;
  browser: string;
  pageCount: number;
  lastPage: string;
  lastSeen: Date | null;
  hasCart: boolean;
  hasCheckout: boolean;
};

export type VisitorsAnalyticsResult = {
  data: VisitorData[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

function rangeToSince(range: string): Date | null {
  if (range === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (range === "7d") return new Date(Date.now() - 7 * 864e5);
  if (range === "30d") return new Date(Date.now() - 30 * 864e5);
  return null; // "all"
}

/**
 * AnalyticsService — single source of truth for admin analytics queries.
 * Called both by the /api/analytics/* routes (client-side re-fetch on
 * filter change) and directly by the analytics page.tsx Server Components
 * (initial page load) so the query logic only lives in one place.
 */
export const AnalyticsService = {
  async getCountriesAnalytics(params: CountriesAnalyticsParams = {}): Promise<CountriesAnalyticsResult> {
    const {
      range = "7d",
      page = 1,
      limit = 50,
      sortBy = "views",
      sortOrder = "desc",
      search = "",
    } = params;

    const since = rangeToSince(range);
    const pvWhere: Prisma.PageViewWhereInput = since ? { createdAt: { gte: since } } : {};
    const searchWhere: Prisma.PageViewWhereInput = search
      ? { country: { contains: search, mode: "insensitive" } }
      : {};

    const totalCountries = await prisma.pageView.groupBy({
      by: ["country"],
      where: { ...pvWhere, ...searchWhere, country: { not: "" } },
    });

    const countriesData = await prisma.pageView.groupBy({
      by: ["country"],
      _count: { id: true },
      where: { ...pvWhere, ...searchWhere, country: { not: "" } },
      orderBy:
        sortBy === "country"
          ? { country: sortOrder as "asc" | "desc" }
          : { _count: { id: sortOrder as "asc" | "desc" } },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: countriesData.map((c) => ({ country: c.country, views: c._count.id })),
      pagination: {
        page,
        limit,
        total: totalCountries.length,
        totalPages: Math.ceil(totalCountries.length / limit),
      },
    };
  },

  async getPagesAnalytics(params: PagesAnalyticsParams = {}): Promise<PagesAnalyticsResult> {
    const {
      range = "7d",
      page = 1,
      limit = 50,
      sortBy = "views",
      sortOrder = "desc",
      search = "",
    } = params;

    const since = rangeToSince(range);
    const pvWhere: Prisma.PageViewWhereInput = since ? { createdAt: { gte: since } } : {};
    // Note: unlike getCountriesAnalytics, this intentionally does NOT filter
    // out empty-string values — matches the original /api/analytics/pages route.
    const searchWhere: Prisma.PageViewWhereInput = search
      ? { page: { contains: search, mode: "insensitive" } }
      : {};

    const totalPages = await prisma.pageView.groupBy({
      by: ["page"],
      where: { ...pvWhere, ...searchWhere },
    });

    const pagesData = await prisma.pageView.groupBy({
      by: ["page"],
      _count: { id: true },
      where: { ...pvWhere, ...searchWhere },
      orderBy:
        sortBy === "page"
          ? { page: sortOrder as "asc" | "desc" }
          : { _count: { id: sortOrder as "asc" | "desc" } },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: pagesData.map((p) => ({ page: p.page, views: p._count.id })),
      pagination: {
        page,
        limit,
        total: totalPages.length,
        totalPages: Math.ceil(totalPages.length / limit),
      },
    };
  },

  async getVisitorsAnalytics(params: VisitorsAnalyticsParams = {}): Promise<VisitorsAnalyticsResult> {
    const {
      range = "7d",
      page = 1,
      limit = 50,
      sortBy = "lastSeen",
      sortOrder = "desc",
      country: filterCountry = "",
      device: filterDevice = "",
      events: filterEvents = "",
    } = params;

    const since = rangeToSince(range);
    const pvWhere: Prisma.PageViewWhereInput = since ? { createdAt: { gte: since } } : {};

    // country/device/events aren't real columns on the grouped session row —
    // they're derived from _max/_min aggregates and a separate events lookup —
    // so they can't be pushed into Prisma's `where`. That means we can't ask
    // the DB to skip/take a filtered page directly: doing so would paginate
    // the *unfiltered* session set, then filter each page down further,
    // silently shrinking pages and reporting totals that don't match what's
    // actually returned. Instead we pull every session in range (sorted by
    // the DB), apply the derived filters in memory, then paginate the
    // filtered array ourselves — so `total`/`totalPages` always describe the
    // result set the client is actually paging through.
    let sessions;
    if (sortBy === "pageCount") {
      sessions = await prisma.pageView.groupBy({
        by: ["sessionId"],
        _count: { id: true },
        _max: { createdAt: true, page: true, country: true, city: true },
        _min: { ip: true, device: true, browser: true },
        where: pvWhere,
        orderBy: { _count: { id: sortOrder as "asc" | "desc" } },
      });
    } else if (sortBy === "country") {
      sessions = await prisma.pageView.groupBy({
        by: ["sessionId"],
        _count: { id: true },
        _max: { createdAt: true, page: true, country: true, city: true },
        _min: { ip: true, device: true, browser: true },
        where: pvWhere,
        orderBy: { _max: { country: sortOrder as "asc" | "desc" } },
      });
    } else {
      sessions = await prisma.pageView.groupBy({
        by: ["sessionId"],
        _count: { id: true },
        _max: { createdAt: true, page: true, country: true, city: true },
        _min: { ip: true, device: true, browser: true },
        where: pvWhere,
        orderBy: { _max: { createdAt: sortOrder as "asc" | "desc" } },
      });
    }

    const sessionIds = sessions.map((s) => s.sessionId);
    const sessionEvents = sessionIds.length
      ? await prisma.analyticsEvent.findMany({
          where: { sessionId: { in: sessionIds }, event: { in: ["add_to_cart", "checkout"] } },
          select: { sessionId: true, event: true },
        })
      : [];

    const evMap = new Map<string, Set<string>>();
    for (const e of sessionEvents) {
      if (!evMap.has(e.sessionId)) evMap.set(e.sessionId, new Set());
      evMap.get(e.sessionId)!.add(e.event);
    }

    let visitors: VisitorData[] = sessions.map((s) => ({
      sessionId: s.sessionId,
      ip: s._min.ip ?? "",
      country: s._max.country ?? "",
      city: s._max.city ?? "",
      device: s._min.device ?? "",
      browser: s._min.browser ?? "",
      pageCount: s._count.id,
      lastPage: s._max.page ?? "",
      lastSeen: s._max.createdAt,
      hasCart: evMap.get(s.sessionId)?.has("add_to_cart") ?? false,
      hasCheckout: evMap.get(s.sessionId)?.has("checkout") ?? false,
    }));

    if (filterCountry) {
      visitors = visitors.filter((v) => v.country.toLowerCase().includes(filterCountry.toLowerCase()));
    }
    if (filterDevice) {
      visitors = visitors.filter((v) => v.device.toLowerCase() === filterDevice.toLowerCase());
    }
    if (filterEvents) {
      if (filterEvents === "cart") visitors = visitors.filter((v) => v.hasCart);
      else if (filterEvents === "checkout") visitors = visitors.filter((v) => v.hasCheckout);
      else if (filterEvents === "both") visitors = visitors.filter((v) => v.hasCart && v.hasCheckout);
      else if (filterEvents === "none") visitors = visitors.filter((v) => !v.hasCart && !v.hasCheckout);
    }

    const total = visitors.length;
    const skip = (page - 1) * limit;
    const paged = visitors.slice(skip, skip + limit);

    return {
      data: paged,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};
