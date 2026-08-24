import { checkPermission } from "@/lib/rbac"
import { AnalyticsService } from "@/lib/services/analyticsService"
import CountriesAnalyticsClient from "./CountriesAnalyticsClient"

export default async function CountriesAnalyticsPage() {
  const session = await checkPermission("Dashboard", "canView")
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to view this page.</div>
  }

  // Defaults here must match CountriesAnalyticsClient's initial filter state
  // (range="7d", page=1, sortBy="views", sortOrder="desc", search="") so the
  // client doesn't immediately re-fetch what we already rendered.
  const initialData = await AnalyticsService.getCountriesAnalytics()

  return <CountriesAnalyticsClient initialData={initialData} />
}
