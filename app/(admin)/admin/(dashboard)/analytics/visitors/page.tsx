import { checkPermission } from "@/lib/rbac"
import { AnalyticsService } from "@/lib/services/analyticsService"
import VisitorsAnalyticsClient from "./VisitorsAnalyticsClient"

export default async function VisitorsAnalyticsPage() {
  const session = await checkPermission("Dashboard", "canView")
  if (!session) {
    return <div className="p-8 text-foreground">You do not have permission to view this page.</div>
  }

  // Defaults here must match VisitorsAnalyticsClient's initial filter state
  // (range="7d", page=1, sortBy="lastSeen", sortOrder="desc", no filters) so
  // the client doesn't immediately re-fetch what we already rendered.
  const initialData = await AnalyticsService.getVisitorsAnalytics()

  return <VisitorsAnalyticsClient initialData={initialData} />
}
