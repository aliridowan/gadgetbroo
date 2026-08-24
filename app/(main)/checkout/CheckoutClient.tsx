"use client";

import { useState, useMemo, useEffect } from "react";
import { useCart } from "@/store/useCart";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Truck, ShieldCheck, CreditCard, Banknote, Smartphone } from "lucide-react";
import { toast } from "sonner";

interface ZoneInfo {
  id: string;
  city: string;
  fee: number;
}

interface SavedAddress {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  isDefault: boolean;
}

interface CheckoutClientProps {
  groupedZones: Record<string, ZoneInfo[]>;
  user: { id: string; name: string; email: string };
  savedAddresses: SavedAddress[];
}

export default function CheckoutClient({ groupedZones, user, savedAddresses }: CheckoutClientProps) {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const [mounted, setMounted] = useState(false);

  // Form State for NEW address
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    savedAddresses.length > 0 ? savedAddresses[0].id : "new"
  );
  const [fullName, setFullName] = useState(user.name || "");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [saveAddress, setSaveAddress] = useState(true);
  
  // Location Dropdowns
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");
  
  // Payment
  const [paymentMethod, setPaymentMethod] = useState<"CASH_ON_DELIVERY" | "BKASH" | "CARD">("CASH_ON_DELIVERY");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  // Calculate Delivery Fee dynamically based on selected city
  const deliveryFee = useMemo(() => {
    let targetState = selectedState;
    let targetCity = selectedCity;
    
    if (selectedAddressId !== "new") {
      const addr = savedAddresses.find(a => a.id === selectedAddressId);
      if (addr) {
        targetState = addr.state;
        targetCity = addr.city;
      }
    }

    if (!targetState || !targetCity) return 0;
    const citiesInState = groupedZones[targetState];
    const city = citiesInState?.find(c => c.city === targetCity);
    return city ? city.fee : 0;
  }, [selectedAddressId, selectedState, selectedCity, groupedZones, savedAddresses]);

  const grandTotal = subtotal + deliveryFee;

  // Whether the "Confirm Order" button should be enabled — has to account
  // for BOTH address paths: a saved address just needs to actually be
  // selected, the new-address form needs its required fields filled.
  // (Previously this only checked `selectedCity`, which is exclusively the
  // new-address form's own state and never gets set when a saved address
  // is picked instead — that's what kept the button permanently disabled
  // for the saved-address path.)
  const hasValidAddress = selectedAddressId === "new"
    ? Boolean(fullName && phone && street && selectedState && selectedCity)
    : savedAddresses.some(a => a.id === selectedAddressId);

  // Handle cascading dropdown reset
  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedState(e.target.value);
    setSelectedCity(""); // Reset city when state changes
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Your cart is empty!");
      return;
    }

    if (selectedAddressId === "new") {
      if (!fullName || !phone || !street || !selectedState || !selectedCity) {
        toast.error("Please fill in all required shipping fields.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // In the next step, we will implement the actual API endpoint /api/checkout
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: selectedAddressId !== "new" ? selectedAddressId : undefined,
          fullName: selectedAddressId === "new" ? fullName : undefined,
          phone: selectedAddressId === "new" ? phone : undefined,
          line1: selectedAddressId === "new" ? street : undefined,
          city: selectedAddressId === "new" ? selectedCity : undefined,
          state: selectedAddressId === "new" ? selectedState : undefined,
          postalCode: selectedAddressId === "new" ? (postalCode || "0000") : undefined,
          saveAddress,
          paymentMethod,
          items: items.map(i => ({
            variantId: i.variantId,
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to place order.");
      }

      const orderData = await response.json();
      
      clearCart();
      toast.success("Order placed successfully!");
      
      // Redirect to a success page (or order status page)
      router.push(`/order/success?id=${orderData.orderId}`);
      
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  if (items.length === 0) {
    return (
      <div className="bg-[#111318] rounded-3xl border border-slate-800 p-16 text-center flex flex-col items-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-6" />
        <h2 className="text-2xl font-bold text-white mb-2">No items to checkout</h2>
        <p className="text-slate-400 mb-8">Please add items to your cart before proceeding.</p>
        <Link href="/store" className="bg-white text-black font-semibold px-8 py-3 rounded-full hover:bg-slate-200">
          Go to Store
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12 items-start">
      
      {/* Left Column: Shipping & Payment */}
      <div className="xl:col-span-7 space-y-8">
        
        {/* Shipping Address Section */}
        <div className="bg-[#111318] rounded-3xl border border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 bg-[#0f1219] flex items-center gap-3">
            <Truck className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">Shipping Address</h2>
          </div>
          
          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Address Selection — dropdown, defaults to the saved address
                the server already sorted first (isDefault, then most
                recently created) */}
            {savedAddresses.length > 0 && (
              <div className="space-y-3 mb-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Deliver to</label>
                  <select
                    value={selectedAddressId}
                    onChange={(e) => setSelectedAddressId(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none"
                  >
                    {savedAddresses.map(addr => (
                      <option key={addr.id} value={addr.id}>
                        {addr.fullName} — {addr.line1}, {addr.city}{addr.isDefault ? " (Default)" : ""}
                      </option>
                    ))}
                    <option value="new">+ Add a new address</option>
                  </select>
                </div>

                {/* Read-only summary of whichever saved address is picked */}
                {selectedAddressId !== "new" && (() => {
                  const addr = savedAddresses.find(a => a.id === selectedAddressId);
                  if (!addr) return null;
                  return (
                    <div className="p-4 rounded-xl border border-slate-800 bg-[#0a0a0a] text-sm text-slate-400 space-y-1">
                      <div className="font-medium text-white flex items-center gap-2">
                        {addr.fullName}
                        {addr.isDefault && <span className="bg-slate-800 text-slate-300 text-[10px] uppercase px-2 py-0.5 rounded-full">Default</span>}
                      </div>
                      <div>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</div>
                      <div>{addr.city}, {addr.state} {addr.postalCode}</div>
                      <div>{addr.phone}</div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* New Address Form */}
            {selectedAddressId === "new" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                {savedAddresses.length > 0 && <div className="h-px bg-slate-800 w-full" />}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Full Name *</label>
                    <input 
                      type="text" 
                      required={selectedAddressId === "new"}
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Phone Number *</label>
                    <input 
                      type="tel" 
                      required={selectedAddressId === "new"}
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
                      placeholder="017..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">State / Division *</label>
                    <select 
                      required={selectedAddressId === "new"}
                      value={selectedState}
                      onChange={handleStateChange}
                      className="w-full bg-[#0a0a0a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none"
                    >
                      <option value="" disabled>Select Division</option>
                      {Object.keys(groupedZones).map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">City / District *</label>
                    <select 
                      required={selectedAddressId === "new"}
                      disabled={!selectedState}
                      value={selectedCity}
                      onChange={e => setSelectedCity(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="" disabled>Select City</option>
                      {selectedState && groupedZones[selectedState]?.map(cityInfo => (
                        <option key={cityInfo.city} value={cityInfo.city}>
                          {cityInfo.city}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Street Address *</label>
                  <input 
                    type="text" 
                    required={selectedAddressId === "new"}
                    value={street}
                    onChange={e => setStreet(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
                    placeholder="House, Road, Area..."
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <label className="text-sm font-medium text-slate-300">Postal Code (Optional)</label>
                    <input 
                      type="text" 
                      value={postalCode}
                      onChange={e => setPostalCode(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
                      placeholder="1200"
                    />
                  </div>
                  
                  <label className="flex items-center gap-3 cursor-pointer mt-6 sm:mt-8">
                    <input 
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-300">Save for future orders</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Method Section */}
        <div className="bg-[#111318] rounded-3xl border border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 bg-[#0f1219] flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">Payment Method</h2>
          </div>
          
          <div className="p-6 sm:p-8 space-y-4">
            <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'CASH_ON_DELIVERY' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-[#0a0a0a] hover:border-slate-700'}`}>
              <input 
                type="radio" 
                name="payment"
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-700" 
                checked={paymentMethod === 'CASH_ON_DELIVERY'}
                onChange={() => setPaymentMethod("CASH_ON_DELIVERY")}
              />
              <div className="flex items-center gap-3">
                <Banknote className="w-6 h-6 text-emerald-400" />
                <div>
                  <div className="font-semibold text-white">Cash on Delivery</div>
                  <div className="text-sm text-slate-400">Pay securely when the product arrives.</div>
                </div>
              </div>
            </label>

            <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'BKASH' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-[#0a0a0a] hover:border-slate-700'}`}>
              <input
                type="radio"
                name="payment"
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-700"
                checked={paymentMethod === 'BKASH'}
                onChange={() => setPaymentMethod("BKASH")}
              />
              <div className="flex items-center gap-3">
                <Smartphone className="w-6 h-6 text-pink-400" />
                <div>
                  <div className="font-semibold text-white">bKash</div>
                  <div className="text-sm text-slate-400">We'll contact you with payment details after you place the order.</div>
                </div>
              </div>
            </label>

            <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'CARD' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-[#0a0a0a] hover:border-slate-700'}`}>
              <input
                type="radio"
                name="payment"
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-700"
                checked={paymentMethod === 'CARD'}
                onChange={() => setPaymentMethod("CARD")}
              />
              <div className="flex items-center gap-3">
                <CreditCard className="w-6 h-6 text-indigo-400" />
                <div>
                  <div className="font-semibold text-white">Card</div>
                  <div className="text-sm text-slate-400">We'll contact you with payment details after you place the order.</div>
                </div>
              </div>
            </label>
          </div>
        </div>

      </div>

      {/* Right Column: Order Summary */}
      <div className="xl:col-span-5">
        <div className="bg-[#111318] rounded-3xl border border-slate-800 overflow-hidden sticky top-24">
          <div className="px-6 py-4 border-b border-slate-800 bg-[#0f1219]">
            <h2 className="text-lg font-bold text-white">Order Summary</h2>
          </div>
          
          <div className="p-6 space-y-6">
            
            {/* Items */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {items.map((item) => (
                <div key={item.variantId} className="flex gap-4">
                  <div className="w-16 h-16 bg-[#0a0a0a] rounded-lg border border-slate-800 flex items-center justify-center relative overflow-hidden flex-shrink-0">
                    <Image
                      src={`${item.image}${item.image.includes('?') ? '&' : '?'}tr=w-150`}
                      alt={item.name}
                      fill
                      unoptimized
                      className="object-contain p-2"
                    />
                    <div className="absolute -top-1 -right-1 bg-blue-600 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0a0a0a]">
                      {item.quantity}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white line-clamp-2 leading-tight mb-1">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {item.variantName !== "Default" ? item.variantName : "Standard Edition"}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-white flex-shrink-0">
                    ৳{(item.price * item.quantity).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            <div className="h-px bg-slate-800 w-full" />

            {/* Totals */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span className="text-white font-medium">৳{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Shipping Fee</span>
                <span className="text-white font-medium">
                  {deliveryFee > 0 ? `৳${deliveryFee.toLocaleString()}` : 'Select city to calculate'}
                </span>
              </div>
            </div>

            <div className="h-px bg-slate-800 w-full" />

            <div className="flex justify-between text-xl font-bold text-white">
              <span>Total</span>
              <span className="text-blue-400">৳{grandTotal.toLocaleString()}</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !hasValidAddress}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-lg font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.15)] mt-6 disabled:shadow-none"
            >
              {isSubmitting ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Confirm Order <CheckCircle2 className="w-5 h-5" /></>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-4">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>SSL Secure Checkout. Data is encrypted.</span>
            </div>
          </div>
        </div>
      </div>

    </form>
  );
}
