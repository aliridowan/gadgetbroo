import { z } from "zod";

export const checkoutSchema = z.object({
  items: z.array(z.object({
    variantId: z.string().min(1),
    productId: z.string().min(1),
    quantity: z.number().min(1),
    price: z.number().min(0)
  })).min(1, "Cart cannot be empty"),
  addressId: z.string().optional(),
  saveAddress: z.boolean().optional(),
  fullName: z.string().optional().transform(val => val ? val.replace(/<[^>]*>?/gm, '') : val),
  phone: z.string().optional(),
  line1: z.string().optional().transform(val => val ? val.replace(/<[^>]*>?/gm, '') : val),
  line2: z.string().optional().transform(val => val ? val.replace(/<[^>]*>?/gm, '') : val),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default("Bangladesh"),
  // Restricted to the three methods actually offered at checkout — was a
  // bare z.string() before, which let a direct API call submit any value
  // (including "STRIPE", a gateway that was never implemented) and still
  // create a real, stock-decremented order. bKash and Card aren't live
  // gateways either — both are manual/unverified like COD, confirmed and
  // marked PAID by an admin after the fact — but at least now only the
  // three methods the storefront actually supports can be submitted.
  paymentMethod: z.enum(["CASH_ON_DELIVERY", "BKASH", "CARD"]),
});
