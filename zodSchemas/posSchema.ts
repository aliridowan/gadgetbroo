import { z } from "zod";

export const posCheckoutSchema = z.object({
  customerName: z.string().min(2, "Customer name must be at least 2 characters").max(100),
  customerPhone: z.string().regex(/^01[3-9]\d{8}$/, "Must be a valid 11-digit BD number starting with 01"),
  customerAddress: z.string().min(5, "Address is required"),
  state: z.string().min(1, "State is required"),
  city: z.string().min(1, "City is required"),
  
  paymentMethod: z.enum(["CASH", "MANUAL_BKASH", "MANUAL_CARD"]),
  discount: z.number().min(0, "Discount cannot be negative").default(0),
  
  items: z.array(
    z.object({
      variantId: z.string().min(1, "Variant ID is required"),
      quantity: z.number().min(1, "Quantity must be at least 1"),
      price: z.number().min(0, "Price cannot be negative"),
      productName: z.string().optional(),
      variantName: z.string().optional(),
      image: z.string().optional(),
    })
  ).min(1, "At least one item is required in the cart"),

  notes: z.string().optional(),
});

export type PosCheckoutValues = z.infer<typeof posCheckoutSchema>;
