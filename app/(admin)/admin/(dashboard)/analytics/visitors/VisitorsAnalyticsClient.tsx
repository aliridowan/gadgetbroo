"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowUpDown } from "lucide-react"
import Link from "next/link"
import type { VisitorsAnalyticsResult } from "@/lib/services/analyticsService"

const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d",    label: "7 Days" },
  { value: "30d",   label: "30 Days" },
  { value: "all",   label: "All Time" },
]

function timeAgo(iso: string | Date | null) {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function VisitorsAnalyticsClient({
  initialData,
}: {
  initialData: VisitorsAnalyticsResult
}) {
  const [range, setRange] = useState("7d")
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState("lastSeen")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [filterDevice, setFilterDevice] = useState("")
  const [filterEvents, setFilterEvents] = useState("")
  const [data, setData] = useState<VisitorsAnalyticsResult | null>(initialData)
  const [loading, setLoading] = useState(false)

  // The server already fetched data matching the defaults above (range="7d",
  // page=1, sortBy="lastSeen", sortOrder="desc", no filters), so skip the
  // very first effect run — it would just re-request the exact same page.
  const isFirstRun = useRef(true)

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    setLoading(true)
    const params = new URLSearchParams({
      range,
      page: String(page),
      limit: "50",
      sortBy,
      sortOrder,
      ...(filterDevice && { device: filterDevice }),
      ...(filterEvents && { events: filterEvents }),
    })
    fetch(`/api/analytics/visitors?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range, page, sortBy, sortOrder, filterDevice, filterEvents])

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("desc")
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Visitor Sessions Analytics</h1>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {RANGES.map((r) => (
            <button key={r.value} onClick={() => { setRange(r.value); setPage(1) }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${range === r.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {r.label}
            </button>
          ))}
        </div>

        <select
          value={filterDevice}
          onChange={(e) => { setFilterDevice(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-border rounded-lg bg-card text-sm"
        >
          <option value="">All Devices</option>
          <option value="mobile">Mobile</option>
          <option value="desktop">Desktop</option>
          <option value="tablet">Tablet</option>
        </select>

        <select
          value={filterEvents}
          onChange={(e) => { setFilterEvents(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-border rounded-lg bg-card text-sm"
        >
          <option value="">All Events</option>
          <option value="cart">Has Add to Cart</option>
          <option value="checkout">Has Checkout</option>
          <option value="both">Has Both</option>
          <option value="none">No Events</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">IP</th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort("country")} className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
                    Location <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Device</th>
                <th className="px-4 py-3 text-right">
                  <button onClick={() => handleSort("pageCount")} className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground ml-auto">
                    Pages <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Last Page</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Events</th>
                <th className="px-4 py-3 text-right">
                  <button onClick={() => handleSort("lastSeen")} className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground ml-auto">
                    Last Seen <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded w-32" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded w-24" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded w-8 ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded w-40" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded w-16" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No data found</td>
                </tr>
              ) : (
                data?.data.map((v) => (
                  <tr key={v.sessionId} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {v.ip ? v.ip.split(".").slice(0, 3).join(".") + ".×" : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {v.country
                        ? <span className="text-foreground">{[v.city, v.country].filter(Boolean).join(", ")}</span>
                        : <span className="text-muted-foreground">Unknown</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{v.device} · {v.browser}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{v.pageCount}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate text-xs">{v.lastPage || "/"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {v.hasCart && <span className="text-xs bg-warning/10 text-warning px-1.5 py-0.5 rounded font-medium">Cart</span>}
                        {v.hasCheckout && <span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded font-medium">Checkout</span>}
                        {!v.hasCart && !v.hasCheckout && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground text-xs whitespace-nowrap">{timeAgo(v.lastSeen)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, data.pagination.total)} of {data.pagination.total} results
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-3 py-1.5 border border-border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                const p = i + 1
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 border rounded-md text-sm ${page === p ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                  >
                    {p}
                  </button>
                )
              })}
              {data.pagination.totalPages > 5 && <span className="px-2 py-1.5 text-sm text-muted-foreground">...</span>}
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === data.pagination.totalPages}
                className="px-3 py-1.5 border border-border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
