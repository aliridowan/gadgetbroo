import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";
import { storeSettingsSchema } from "@/zodSchemas/storeSettingsSchema";
import { StoreSettingsService } from "@/lib/services/storeSettingsService";

export async function GET() {
  try {
    const session = await checkPermission("Settings", "canView");
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const settings = await StoreSettingsService.getSettings();

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await checkPermission("Settings", "canUpdate");
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    
    // Zod Validation
    const validationResult = storeSettingsSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.flatten().fieldErrors }, 
        { status: 400 }
      );
    }

    const settings = await StoreSettingsService.saveSettings(validationResult.data);

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
