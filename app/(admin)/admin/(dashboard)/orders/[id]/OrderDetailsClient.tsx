"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Package, Truck, CreditCard,
  User, MapPin, Calendar, CheckCircle2, Save, FileText
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OrderItemDetails = {
  id: string;
  imageSnapshot: string | null;
  productName: string;
  variantName: string;
  skuAtOrder: string;
  priceAtOrder: number;
  quantity: number;
};

// Must match TERMINAL_ORDER_STATUSES in lib/services/orderService.ts —
// duplicated here rather than imported because that module pulls in prisma
// (server-only) at module scope, which can't be bundled into a client
// component. Once an order is one of these, status/paymentStatus/
// trackingNumber are locked server-side (see the PATCH route); this list
// mirrors that so the UI shows locked badges instead of controls that
// would just fail with a 409.
const LOCKED_STATUSES = new Set(["CANCELLED", "DELIVERED", "REFUNDED"]);

type OrderDetails = {
  id: string;
  createdAt: string;
  status: string;
  items: OrderItemDetails[];
  subtotal: number;
  discount: number;
  total: number;
  user: { name: string; email: string } | null;
  address: {
    fullName: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
  } | null;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  orderSource: string;
  paymentMethod: string;
  paymentStatus: string;
  trackingNumber: string | null;
  adminNotes: string | null;
};

export default function OrderDetailsClient({
  orderId,
  initialOrder,
}: {
  orderId: string;
  initialOrder: OrderDetails;
}) {
  const router = useRouter();

  const [order, setOrder] = useState<OrderDetails>(initialOrder);
  const [updating, setUpdating] = useState(false);
  const locked = LOCKED_STATUSES.has(order.status);

  const [trackingNumber, setTrackingNumber] = useState(initialOrder.trackingNumber || "");
  const [adminNotes, setAdminNotes] = useState(initialOrder.adminNotes || "");

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) throw new Error("Failed to fetch order");
      const data = await res.json();
      setOrder(data.order);
      setTrackingNumber(data.order.trackingNumber || "");
      setAdminNotes(data.order.adminNotes || "");
    } catch (error) {
      toast.error("Could not load order details");
      router.push("/admin/orders");
    }
  };

  const updateField = async (field: string, value: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Failed to update ${field}`);
      }
      toast.success("Order updated successfully");
      fetchOrder();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update order");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 mt-2 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/orders" className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              Order #{order.id.slice(-8).toUpperCase()}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <Calendar size={12} />
              Placed on {format(new Date(order.createdAt), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex gap-3">
            {/* Status Progression Dropdown — locked once terminal */}
            <div className="relative">
              {locked ? (
                <span
                  title={`This order is ${order.status} and can no longer be changed.`}
                  className="inline-flex items-center h-10 min-w-[140px] px-3 rounded-lg text-sm font-medium border border-border bg-muted text-muted-foreground cursor-not-allowed"
                >
                  {order.status}
                </span>
              ) : (
                <select
                  value={order.status}
                  disabled={updating}
                  onChange={(e) => updateField('status', e.target.value)}
                  className="pl-3 pr-8 py-2 bg-card border border-border text-foreground rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none h-10 min-w-[140px] disabled:opacity-50"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="PROCESSING">PROCESSING</option>
                  <option value="SHIPPED">SHIPPED</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="REFUNDED">REFUNDED</option>
                </select>
              )}
              {updating && !locked && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground pointer-events-none" />}
            </div>
          </div>
          {locked && (
            <p className="text-[11px] text-muted-foreground">This order is locked and can no longer be modified.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Order Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <Package size={16} className="text-blue-400" /> Items Ordered
            </h2>
            <div className="divide-y divide-border">
              {order.items.map((item: OrderItemDetails) => (
                <div key={item.id} className="py-4 flex gap-4">
                  <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden shrink-0 border border-border">
                    {item.imageSnapshot ? (
                       // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${item.imageSnapshot}${item.imageSnapshot.includes('?') ? '&' : '?'}tr=w-200`}
                        alt={item.productName}
                        className="w-full h-full object-contain p-1 bg-white"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600"><Package size={20} /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">{item.productName}</h3>
                    <p className="text-[11px] text-muted-foreground mt-1">{item.variantName}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">SKU: {item.skuAtOrder}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium text-foreground">${Number(item.priceAtOrder).toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Qty: {item.quantity}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span>${Number(order.subtotal).toFixed(2)}</span>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-xs text-emerald-400">
                  <span>Discount</span>
                  <span>-${Number(order.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-medium text-foreground pt-2 border-t border-border">
                <span>Total</span>
                <span>${Number(order.total).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Customer & Shipping Info */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
             <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <User size={16} className="text-purple-400" /> Customer Info
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Name</div>
                <div className="text-muted-foreground font-medium">{order.user?.name || order.customerName || "Guest (Walk-in)"}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Email / Source</div>
                <div className="text-muted-foreground">{order.user?.email || `POS Order`}</div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
             <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <MapPin size={16} className="text-emerald-400" /> Shipping Address
            </h2>
            <div className="space-y-1 text-sm text-muted-foreground">
              {order.address ? (
                <>
                  <div className="font-medium">{order.address.fullName}</div>
                  <div>{order.address.line1}</div>
                  {order.address.line2 && <div>{order.address.line2}</div>}
                  <div>{order.address.city}, {order.address.state} {order.address.postalCode}</div>
                  <div>{order.address.country}</div>
                  <div className="pt-2 text-muted-foreground flex items-center gap-2">
                    Phone: {order.address.phone}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-medium">{order.customerName}</div>
                  <div className="text-muted-foreground">{order.customerAddress || "Store Pickup"}</div>
                  <div className="pt-2 text-muted-foreground flex items-center gap-2">
                    Phone: {order.customerPhone}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
             <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <CreditCard size={16} className="text-amber-400" /> Payment Details
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Method</div>
                <div className="text-muted-foreground capitalize">{order.paymentMethod.replace(/_/g, ' ').toLowerCase()}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Status</div>
                <div className="relative max-w-[160px]">
                  {locked ? (
                    <span
                      title={`This order is ${order.status} — payment status can no longer be changed.`}
                      className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-muted text-muted-foreground cursor-not-allowed"
                    >
                      {order.paymentStatus}
                    </span>
                  ) : (
                    <select
                      value={order.paymentStatus}
                      disabled={updating}
                      onChange={(e) => updateField('paymentStatus', e.target.value)}
                      className="w-full pl-3 pr-8 py-1.5 bg-background border border-border text-foreground rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none disabled:opacity-50"
                    >
                      <option value="UNPAID">UNPAID</option>
                      <option value="PAID">PAID</option>
                      <option value="FAILED">FAILED</option>
                      <option value="REFUNDED">REFUNDED</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
             <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <Truck size={16} className="text-blue-400" /> Fulfillment
            </h2>
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Tracking Number</div>
                <div className="flex gap-2">
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g. STEADFAST-1234"
                    disabled={locked}
                    className="bg-background border-border text-foreground h-9 text-xs disabled:opacity-50"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => updateField('trackingNumber', trackingNumber)}
                    disabled={locked || updating || trackingNumber === (order.trackingNumber || "")}
                    className="h-9 px-3 shrink-0"
                  >
                    <Save size={14} />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
             <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <FileText size={16} className="text-muted-foreground" /> Admin Notes
            </h2>
            <div className="space-y-3">
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Internal notes about this order..."
                className="w-full h-24 bg-background border border-border rounded-md p-3 text-xs text-muted-foreground focus:outline-none focus:border-blue-500 transition-colors resize-none"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => updateField('adminNotes', adminNotes)}
                disabled={updating || adminNotes === (order.adminNotes || "")}
                className="w-full gap-2 text-xs h-8"
              >
                <Save size={14} /> Save Notes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
