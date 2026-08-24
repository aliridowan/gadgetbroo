import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";
import { PageContentService } from "@/lib/services/pageContentService";

// GET a page content for the admin
export async function GET(request: NextRequest) {
  try {
    const session = await checkPermission("Settings", "canView");
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const language = searchParams.get("language") || "en";

    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const page = await PageContentService.getPage(slug, language);

    return NextResponse.json({ page });
  } catch (error) {
    console.error("Error fetching page:", error);
    return NextResponse.json({ error: "Failed to fetch page" }, { status: 500 });
  }
}

// Save or Update page content
export async function POST(request: NextRequest) {
  try {
    const session = await checkPermission("Settings", "canUpdate");
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { slug, language, content } = body;

    if (!slug || !language || content === undefined) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const page = await PageContentService.savePage(slug, language, content);

    return NextResponse.json({ success: true, page });
  } catch (error) {
    console.error("Error saving page:", error);
    return NextResponse.json({ error: "Failed to save page" }, { status: 500 });
  }
}
