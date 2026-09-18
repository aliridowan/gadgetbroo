import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const resolvedParams = await searchParams;
  const orderId = resolvedParams.id;
  const showOrderId = orderId?.slice(-8).toUpperCase()

  return (
    <div className="bg-background min-h-screen text-primary py-20 px-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-background rounded-3xl border border-slate-800 p-8 sm:p-12 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Order Confirmed!</h1>
        <p className="text-slate-400 mb-8">
          Thank you for your purchase. We are processing your order.
        </p>

        {orderId && (
          <div className="bg-[#0a0a0a] rounded-xl p-4 border border-slate-800 mb-8">
            <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Order ID</div>
            <div className="text-sm font-mono text-white break-all">#{showOrderId}</div>
          </div>
        )}

        <Link
          href="/store"
          className="w-full bg-white text-black text-lg font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
        >
          Continue Shopping <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
