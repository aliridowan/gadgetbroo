"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowUpDown, Search } from "lucide-react"
import Link from "next/link"
import type { CountriesAnalyticsResult } from "@/lib/services/analyticsService"

const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d",    label: "7 Days" },
  { value: "30d",   label: "30 Days" },
  { value: "all",   label: "All Time" },
]

export default function CountriesAnalyticsClient({
  initialData,
}: {
  initialData: CountriesAnalyticsResult
}) {
  const [range, setRange] = useState("7d")
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState("views")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [data, setData] = useState<CountriesAnalyticsResult | null>(initialData)
  const [loading, setLoading] = useState(false)

  // The server already fetched data matching the defaults above (range="7d",
  // page=1, sortBy="views", sortOrder="desc", search=""), so skip the very
  // first effect run — it would just re-request the exact same page.
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
      search,
    })
    fetch(`/api/analytics/countries?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range, page, sortBy, sortOrder, search])

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("desc")
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const maxViews = data?.data[0]?.views ?? 1

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Top Countries Analytics</h1>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {RANGES.map((r) => (
            <button key={r.value} onClick={() => { setRange(r.value); setPage(1) }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${range === r.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {r.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search countries..."
              className="pl-9 pr-3 py-2 border border-border rounded-lg bg-card text-sm w-64"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort("country")} className="flex items-center gap-2 font-medium text-muted-foreground hover:text-foreground">
                    Country <ArrowUpDown className="w-4 h-4" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button onClick={() => handleSort("views")} className="flex items-center gap-2 font-medium text-muted-foreground hover:text-foreground ml-auto">
                    Views <ArrowUpDown className="w-4 h-4" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right w-1/2">
                  <span className="text-xs text-muted-foreground">Percentage</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded w-32" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded w-16 ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-2 bg-muted animate-pulse rounded w-full" /></td>
                  </tr>
                ))
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No data found</td>
                </tr>
              ) : (
                data?.data.map(({ country, views }) => (
                  <tr key={country} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-foreground font-medium">{country}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground font-mono">{views.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-success/70 rounded-full" style={{ width: `${(views / maxViews) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-12 text-right">{((views / maxViews) * 100).toFixed(1)}%</span>
                      </div>
                    </td>
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
