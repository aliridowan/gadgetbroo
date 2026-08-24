"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { posCheckoutSchema, type PosCheckoutValues } from "@/zodSchemas/posSchema";
import { Search, ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/loading-button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import Image from "next/image";

type POSProduct = {
  id: string;
  name: string;
  brand: string;
  images: { mediaFile: { url: string } }[];
  variants: {
    id: string;
    name: string;
    sku: string;
    price: number;
    stock: number;
  }[];
};

type ShippingZone = {
  id: string;
  stateName: string;
  cityName: string;
  deliveryFee: string;
};

export default function POSClient({
  initialProducts,
  initialShippingZones,
}: {
  initialProducts: POSProduct[];
  initialShippingZones: ShippingZone[];
}) {
  const [products] = useState<POSProduct[]>(initialProducts);
  const [shippingZones] = useState<ShippingZone[]>(initialShippingZones);
  const [search, setSearch] = useState("");
  const [mobileTab, setMobileTab] = useState<"products" | "cart">("products");
  const [discountPercent, setDiscountPercent] = useState<string>("");

  const form = useForm<PosCheckoutValues>({
    resolver: zodResolver(posCheckoutSchema) as any,
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerAddress: "",
      state: "",
      city: "",
      paymentMethod: "CASH",
      discount: 0,
      items: [],
      notes: "",
    },
  });

  const { fields: cartItems, append, update, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const handleAddToCart = (variant: POSProduct["variants"][0], product: POSProduct) => {
    if (variant.stock <= 0) {
      toast.error("Out of stock!");
      return;
    }

    const existingIndex = cartItems.findIndex((item) => item.variantId === variant.id);
    if (existingIndex >= 0) {
      const current = cartItems[existingIndex];
      if (current.quantity >= variant.stock) {
        toast.error("Not enough stock!");
        return;
      }
      update(existingIndex, { ...current, quantity: current.quantity + 1 });
    } else {
      append({
        variantId: variant.id,
        quantity: 1,
        price: Number(variant.price),
        productName: product.name,
        variantName: variant.name === "Default" ? "Standard" : variant.name,
        image: product.images?.[0]?.mediaFile?.url || ""
      });
    }

    // Switch to cart automatically on mobile if item added
    const displayName = variant.name === "Default" ? product.name : `${product.name} (${variant.name})`;
    toast.success(`${displayName} added to cart`);
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  };

  const subtotal = calculateSubtotal();

  useEffect(() => {
    if (discountPercent !== "") {
      const p = Number(discountPercent);
      if (p > 0) {
        form.setValue("discount", Math.round(subtotal * (p / 100)));
      }
    }
  }, [subtotal, discountPercent, form]);

  const state = form.watch("state");
  const city = form.watch("city");
  const discount = form.watch("discount") || 0;

  const selectedZone = shippingZones.find((z) => z.stateName === state && z.cityName === city);
  const deliveryFee = selectedZone ? Number(selectedZone.deliveryFee) : 0;

  const total = Math.max(0, subtotal + deliveryFee - discount);

  const states = Array.from(new Set(shippingZones.map((z) => z.stateName)));
  const availableCities = shippingZones.filter((z) => z.stateName === state).map((z) => z.cityName);

  const onSubmit = async (data: PosCheckoutValues) => {
    try {
      const res = await fetch("/api/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Failed to process POS order");
        return;
      }

      toast.success("Order placed successfully!");
      form.reset({
        ...form.getValues(),
        items: [],
        discount: 0,
        customerName: "",
        customerPhone: "",
        customerAddress: "",
        notes: "",
      });
      setMobileTab("products");
    } catch (err) {
      toast.error("Something went wrong");
    }
  };

  const filteredProducts = search.trim() === "" ? [] : products.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-4">
      {/* Mobile Tab Switcher */}
      <div className="flex md:hidden bg-card p-1.5 rounded-lg border border-border shrink-0">
        <button
          onClick={() => setMobileTab("products")}
          className={`flex-1 py-2 text-sm rounded-md font-medium transition-colors ${mobileTab === 'products' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Products
        </button>
        <button
          onClick={() => setMobileTab("cart")}
          className={`flex-1 py-2 text-sm rounded-md font-medium transition-colors ${mobileTab === 'cart' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Cart ({cartItems.length})
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
      {/* Left Side: Products Grid */}
      <div className={`flex-1 flex-col gap-4 bg-card border border-border rounded-xl p-4 overflow-hidden ${mobileTab === 'products' ? 'flex' : 'hidden md:flex'}`}>
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search products by name or brand..."
              className="pl-10 h-10 border-border bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {search.trim() === "" ? (
            <p className="text-muted-foreground col-span-full text-center py-8">Type in the search bar above to find products...</p>
          ) : filteredProducts.length === 0 ? (
            <p className="text-muted-foreground col-span-full text-center py-8">No products found.</p>
          ) : (
            filteredProducts.map((product) => (
              <div key={product.id} className="bg-background border border-border rounded-lg p-3 flex flex-col gap-3">
                <div className="aspect-square relative rounded-md overflow-hidden bg-black flex items-center justify-center">
                  {product.images?.[0]?.mediaFile?.url ? (
                    <Image
                      src={`${product.images[0].mediaFile.url}?tr=w-300`}
                      alt={product.name}
                      width={150}
                      height={150}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">No Image</span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground line-clamp-1">{product.name}</h3>
                  <p className="text-xs text-muted-foreground">{product.brand}</p>
                </div>

                <div className="mt-auto space-y-2">
                  {product.variants.map((variant) => (
                    <div key={variant.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-muted">
                      <span className="truncate flex-1 text-left text-muted-foreground">
                        {variant.name === "Default" ? "Standard" : variant.name}
                      </span>
                      <span className="font-medium mx-2 text-foreground">৳{variant.price}</span>
                      <button
                        onClick={() => handleAddToCart(variant, product)}
                        disabled={variant.stock <= 0}
                        className="p-1 rounded bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 shrink-0 transition-colors"
                        title="Add to Cart"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Side: Checkout Cart */}
      <div className={`w-full md:w-[400px] flex-col gap-4 bg-card border border-border rounded-xl p-4 overflow-hidden ${mobileTab === 'cart' ? 'flex' : 'hidden md:flex'}`}>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 border-b border-border pb-3 shrink-0">
          <ShoppingCart size={20} /> Current Order
        </h2>

        {/* Scrollable Container for both Cart Items and Checkout Form */}
        <div className="flex-1 overflow-y-auto pr-2 flex flex-col">
          {/* Cart Items */}
          <div className="space-y-3">
            {cartItems.length === 0 ? (
              <div className="py-8 flex items-center justify-center text-muted-foreground text-sm">
              Cart is empty
            </div>
          ) : (
            cartItems.map((item, index) => {
              const stock = products.find(p => p.variants.some(v => v.id === item.variantId))?.variants.find(v => v.id === item.variantId)?.stock || 0;

              return (
                <div key={item.id} className="flex flex-col gap-3 bg-background p-3 rounded-lg border border-border">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 bg-black rounded shrink-0 flex items-center justify-center overflow-hidden">
                      {item.image ? (
                        <Image src={`${item.image}?tr=w-100`} alt={item.productName || "Product"} width={48} height={48} className="object-cover w-full h-full" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">No Img</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{item.productName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.variantName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground whitespace-nowrap">৳{item.price * item.quantity}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (item.quantity > 1) update(index, { ...item, quantity: item.quantity - 1 });
                          else remove(index);
                        }}
                        className="p-1 rounded bg-secondary hover:bg-secondary/80 text-foreground"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-sm w-4 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (item.quantity < stock) update(index, { ...item, quantity: item.quantity + 1 });
                        }}
                        className="p-1 rounded bg-secondary hover:bg-secondary/80 text-foreground"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button type="button" onClick={() => remove(index)} className="text-destructive hover:text-red-300">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Checkout Form & Totals */}
        <div className="border-t border-border pt-4 mt-auto shrink-0 pb-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="customerName" render={({ field }) => (
                  <FormItem><FormControl><Input placeholder="Customer Name" className="h-9 text-sm" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="customerPhone" render={({ field }) => (
                  <FormItem><FormControl><Input placeholder="Phone Number" className="h-9 text-sm" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <select
                        className="w-full h-9 bg-background border border-border text-foreground text-sm rounded-md px-3 outline-none focus:border-slate-500"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          form.setValue("city", "");
                        }}
                      >
                        <option value="">Select State</option>
                        {states.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <select
                        className="w-full h-9 bg-background border border-border text-foreground text-sm rounded-md px-3 outline-none focus:border-slate-500"
                        {...field}
                        disabled={!state}
                      >
                        <option value="">Select City</option>
                        {availableCities.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="customerAddress" render={({ field }) => (
                <FormItem><FormControl><Input placeholder="Detailed Address (Street, House No.)" className="h-9 text-sm" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <select className="w-full h-9 bg-background border border-border text-foreground text-sm rounded-md px-3 outline-none" {...field}>
                        <option value="CASH">Cash</option>
                        <option value="MANUAL_BKASH">bKash</option>
                        <option value="MANUAL_CARD">Card</option>
                      </select>
                    </FormControl>
                  </FormItem>
                )} />
                <div className="flex gap-2">
                  <Input type="number" placeholder="%" min="0" max="100" className="h-9 text-sm w-16 px-2 text-center" value={discountPercent} onChange={(e) => {
                     let val = e.target.value;
                     if (val === "") {
                       setDiscountPercent("");
                       form.setValue('discount', 0);
                       return;
                     }

                     let p = Number(val);
                     if (isNaN(p)) return; // Ignore invalid characters entirely

                     if (p > 100) p = 100;
                     if (p < 0) p = 0;

                     setDiscountPercent(p.toString());
                     form.setValue('discount', Math.round(subtotal * (p / 100)));
                  }} />
                  <FormField control={form.control} name="discount" render={({ field }) => (
                    <FormItem className="flex-1"><FormControl><Input type="number" placeholder="Discount (৳)" className="h-9 text-sm" {...field} onChange={e => {
                       field.onChange(Number(e.target.value) || 0);
                       setDiscountPercent(""); // Clear percent when flat is changed manually
                    }} /></FormControl></FormItem>
                  )} />
                </div>
              </div>

              <div className="bg-background p-3 rounded-lg border border-border space-y-1.5">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>৳{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Delivery Fee</span>
                  <span>৳{deliveryFee.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-400">
                    <span>Discount</span>
                    <span>-৳{discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-foreground border-t border-border pt-1.5 mt-1.5">
                  <span>Total</span>
                  <span>৳{total.toFixed(2)}</span>
                </div>
              </div>

              <LoadingButton
                type="submit"
                loading={form.formState.isSubmitting}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={cartItems.length === 0}
              >
                Place Order (৳{total.toFixed(2)})
              </LoadingButton>
            </form>
          </Form>
        </div>
        </div>
      </div>
      </div>
    </div>
  );
}
