import prisma from "@/lib/prisma";

export type ShippingZoneListItem = {
  stateName: string;
  cityName: string;
};

export type ShippingZoneFull = {
  id: string;
  stateName: string;
  cityName: string;
  deliveryFee: string;
  isActive: boolean;
};

/**
 * ShippingZoneService — single source of truth for reading the shipping
 * zones list. Called both by GET /api/shipping-zones (client-side re-fetch
 * / the future shipping admin page) and directly by orders/page.tsx, which
 * only needs the state/city names to build its district/city filter
 * dropdowns — deliverFee is a Prisma Decimal and isn't needed there, so
 * it's left out of this shape rather than trimmed at the call site.
 */
export const ShippingZoneService = {
  async getZoneLocations(): Promise<ShippingZoneListItem[]> {
    return prisma.shippingZone.findMany({
      orderBy: [{ stateName: "asc" }, { cityName: "asc" }],
      select: { stateName: true, cityName: true },
    });
  },

  /**
   * The full zone list, including delivery fee — for consumers (POS, the
   * /api/shipping-zones route itself) that actually need to calculate a
   * shipping cost, not just populate a district/city dropdown.
   * `deliveryFee` is converted to a plain string here (matching what the
   * JSON API has always returned via Decimal.toJSON()) since a raw
   * Prisma Decimal can't cross the server → client component boundary.
   * Note: unlike the storefront's own checkout page (which filters
   * `isActive: true`), this intentionally returns every zone regardless of
   * `isActive` — matching what GET /api/shipping-zones has always done.
   */
  async getAllZones(): Promise<ShippingZoneFull[]> {
    const zones = await prisma.shippingZone.findMany({
      orderBy: [{ stateName: "asc" }, { cityName: "asc" }],
    });
    return zones.map((z) => ({
      id: z.id,
      stateName: z.stateName,
      cityName: z.cityName,
      deliveryFee: z.deliveryFee.toString(),
      isActive: z.isActive,
    }));
  },

  /**
   * Field-presence validation and the P2002 (duplicate stateName+cityName)
   * error-message formatting both stay in the route handlers, matching
   * their existing behavior exactly — these three just do the write.
   */
  async createZone(data: { stateName: string; cityName: string; deliveryFee: number; isActive?: boolean }) {
    return prisma.shippingZone.create({
      data: {
        stateName: data.stateName,
        cityName: data.cityName,
        deliveryFee: data.deliveryFee,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  },

  async updateZone(
    id: string,
    data: { stateName?: string; cityName?: string; deliveryFee?: number; isActive?: boolean }
  ) {
    return prisma.shippingZone.update({
      where: { id },
      data: {
        ...(data.stateName && { stateName: data.stateName }),
        ...(data.cityName && { cityName: data.cityName }),
        ...(data.deliveryFee !== undefined && { deliveryFee: data.deliveryFee }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  },

  async deleteZone(id: string) {
    await prisma.shippingZone.delete({ where: { id } });
  },
};
