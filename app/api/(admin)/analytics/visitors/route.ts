import { NextResponse } from "next/server"
import { checkPermission } from "@/lib/rbac"
import { AnalyticsService } from "@/lib/services/analyticsService"

export async function GET(req: Request) {
  const session = await checkPermission("Dashboard", "canView")
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)

  const result = await AnalyticsService.getVisitorsAnalytics({
    range: searchParams.get("range") ?? undefined,
    page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : undefined,
    limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
    sortBy: searchParams.get("sortBy") ?? undefined,
    sortOrder: searchParams.get("sortOrder") ?? undefined,
    country: searchParams.get("country") ?? undefined,
    device: searchParams.get("device") ?? undefined,
    events: searchParams.get("events") ?? undefined,
  })

  return NextResponse.json(result)
}
