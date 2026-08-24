"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import URLPagination from "@/components/URLPagination"
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react"

type Order = {
  id: string
  orderCode: string
  customerName: string
  customerPhone: string
  district: string
  city: string
  status: string
  total: number
  createdAt: string
}

type PageData = { orders: Order[]; total: number; page: number; pages: number }

const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]

// Must match TERMINAL_ORDER_STATUSES in lib/services/orderService.ts —
// duplicated here rather than imported because that module pulls in prisma
// (server-only) at module scope, which can't be bundled into a client
// component. Once an order is one of these, its status is locked server-
// side (see the PATCH route) — this list mirrors that so the UI shows a
// locked badge instead of a dropdown that would just fail with a 409.
const LOCKED_STATUSES = new Set(["CANCELLED", "DELIVERED", "REFUNDED"])

const STATUS_COLORS: Record<string, string> = {
  PENDING:    "bg-warning/10 text-warning border-warning/30",
  CONFIRMED:  "bg-primary/10 text-primary border-primary/30",
  PROCESSING: "bg-primary/10 text-primary border-primary/30",
  SHIPPED:    "bg-accent/10 text-accent border-accent/30",
  DELIVERED:  "bg-success/10 text-success border-success/30",
  CANCELLED:  "bg-destructive/10 text-destructive border-destructive/30",
}

const inputCls = "px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"

// ── Inline status dropdown ───────────────────────────────────────
function StatusCell({ order, onUpdated }: { order: Order; onUpdated: (id: string, s: string) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const locked = LOCKED_STATUSES.has(order.status)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  async function pick(status: string) {
    if (status === order.status) { setOpen(false); return }
    setSaving(true)
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    setSaving(false); setOpen(false)
    if (res.ok) { onUpdated(order.id, status); toast.success("Status updated") }
    else {
      const data = await res.json().catch(() => null)
      toast.error(data?.error || "Failed to update status")
    }
  }

  if (locked) {
    return (
      <span
        title={`This order is ${order.status} and can no longer be changed.`}
        className={`text-xs font-medium px-2.5 py-1 rounded-full border cursor-not-allowed ${STATUS_COLORS[order.status] ?? "bg-muted text-muted-foreground border-border"}`}
      >
        {order.status}
      </span>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        className={`text-xs font-medium px-2.5 py-1 rounded-full border cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 ${STATUS_COLORS[order.status] ?? "bg-muted text-muted-foreground border-border"}`}
      >
        {saving ? "…" : order.status}
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-xl py-1 min-w-36">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => pick(s)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors flex items-center gap-2 ${s === order.status ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${s === order.status ? "bg-primary" : "bg-muted-foreground/30"}`} />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sortable column header ───────────────────────────────────────
function SortTh({ label, field, sort, dir, onSort }: {
  label: string; field: string; sort: string; dir: string; onSort: (f: string) => void
}) {
  const active = sort === field
  return (
    <th className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">
      <button onClick={() => onSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
        {label}
        {active
          ? dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
          : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </th>
  )
}

// ── Main content ────────────────────────────────────────────────
export default function OrdersClient({
  initialData,
  initialZones,
}: {
  initialData: PageData
  initialZones: { stateName: string; cityName: string }[]
}) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()

  const page     = parseInt(sp.get("page")     ?? "1")
  const search   = sp.get("search")   ?? ""
  const status   = sp.get("status")   ?? ""
  const district = sp.get("district") ?? ""
  const city     = sp.get("city")     ?? ""
  const from     = sp.get("from")     ?? ""
  const to       = sp.get("to")       ?? ""
  const sort     = sp.get("sort")     ?? "createdAt"
  const dir      = sp.get("dir")      ?? "desc"

  const [data, setData]         = useState<PageData | null>(initialData)
  const [loading, setLoading]   = useState(false)
  const [searchInput, setSearchInput] = useState(search)
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Districts/cities derived once from the server-supplied zone list — same
  // derivation the client used to run itself after fetching
  // `/api/shipping-zones` on mount; this is just fed synchronously now.
  const [districts] = useState<string[]>(() =>
    Array.from(new Set(initialZones.map((z) => z.stateName)))
  )
  const [citiesByDistrict] = useState<Record<string, string[]>>(() => {
    const cityMap: Record<string, string[]> = {}
    initialZones.forEach((z) => {
      if (!cityMap[z.stateName]) cityMap[z.stateName] = []
      if (!cityMap[z.stateName].includes(z.cityName)) cityMap[z.stateName].push(z.cityName)
    })
    return cityMap
  })

  function push(params: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    Object.entries(params).forEach(([k, v]) => v ? next.set(k, v) : next.delete(k))
    next.set("page", "1")
    router.push(`${pathname}?${next.toString()}`)
  }

  function setPage(p: number) {
    const next = new URLSearchParams(sp.toString())
    next.set("page", String(p))
    router.push(`${pathname}?${next.toString()}`)
  }

  function onSort(field: string) {
    push({ sort: field, dir: sort === field && dir === "desc" ? "asc" : "desc" })
  }

  function handleSearchChange(v: string) {
    setSearchInput(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => push({ search: v }), 400)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), sort, dir, limit: "15" })
    if (search)   params.set("search",   search)
    if (status)   params.set("status",   status)
    if (district) params.set("district", district)
    if (city)     params.set("city",     city)
    if (from)     params.set("from", from)
    if (to)       params.set("to", to)
    const res = await fetch(`/api/orders?${params}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [page, search, status, district, city, from, to, sort, dir])

  // The server already fetched data matching the defaults above (page=<from
  // URL>, no filters), so skip the very first effect run — it would just
  // re-request the exact same page.
  const isFirstRun = useRef(true)

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    fetchData()
  }, [fetchData])

  function onStatusUpdated(id: string, newStatus: string) {
    setData((prev) => prev
      ? { ...prev, orders: prev.orders.map((o) => o.id === id ? { ...o, status: newStatus } : o) }
      : prev)
  }

  const hasFilters = search || status || district || city || from || to
  const citiesForDistrict = district ? (citiesByDistrict[district] ?? []) : []

  return (
    <div className="space-y-4 p-6">

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            className={`${inputCls} w-full pl-9 pr-8`}
            placeholder="Order ID, name, phone, district…"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(""); push({ search: "" }) }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* District */}
        {districts.length > 0 && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">District</label>
            <select
              className={inputCls}
              value={district}
              onChange={(e) => push({ district: e.target.value, city: "" })}
            >
              <option value="">All districts</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}

        {/* City — only when the selected district has city-level orders */}
        {citiesForDistrict.length > 0 && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">City</label>
            <select
              className={inputCls}
              value={city}
              onChange={(e) => push({ city: e.target.value })}
            >
              <option value="">All cities</option>
              {citiesForDistrict.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-muted-foreground mb-1">From</label>
          <input type="date" className={inputCls} value={from} onChange={(e) => push({ from: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">To</label>
          <input type="date" className={inputCls} value={to} onChange={(e) => push({ to: e.target.value })} />
        </div>
        {hasFilters && (
          <button onClick={() => { setSearchInput(""); router.push(pathname) }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2 transition-colors">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* ── Status tabs ── */}
      <div className="flex flex-wrap gap-1.5">
        {["", ...STATUSES].map((s) => (
          <button key={s} onClick={() => push({ status: s })}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              status === s
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <SortTh label="Order ID"  field="orderCode"    sort={sort} dir={dir} onSort={onSort} />
              <SortTh label="Customer"  field="customerName" sort={sort} dir={dir} onSort={onSort} />
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Phone</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">District / City</th>
              <SortTh label="Total"     field="total"        sort={sort} dir={dir} onSort={onSort} />
              <SortTh label="Status"    field="status"       sort={sort} dir={dir} onSort={onSort} />
              <SortTh label="Date"      field="createdAt"    sort={sort} dir={dir} onSort={onSort} />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && data?.orders.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No orders found.</td></tr>
            )}
            {!loading && data?.orders.map((order) => (
              <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-mono font-medium text-foreground whitespace-nowrap">{order.orderCode}</td>
                <td className="px-4 py-3 text-foreground max-w-36 truncate">{order.customerName}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{order.customerPhone}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {order.district
                    ? <>{order.district}{order.city && <span className="opacity-60"> / {order.city}</span>}</>
                    : <span className="opacity-30">—</span>}
                </td>
                <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">৳{Number(order.total).toFixed(0)}</td>
                <td className="px-4 py-3"><StatusCell order={order} onUpdated={onStatusUpdated} /></td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${order.id}`} className="text-primary hover:underline text-xs font-medium">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {data && (data.pages > 1 || data.total > 0) && (
        <URLPagination currentPage={page} totalPages={data.pages} />
      )}
    </div>
  )
}
