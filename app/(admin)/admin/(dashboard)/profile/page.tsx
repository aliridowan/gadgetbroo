// app/(admin)/admin/(dashboard)/profile/page.tsx
import { requireAdmin } from "@/lib/rbac";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  // Same restriction /api/profile enforces — this page manages the
  // super-admin's own identity, not a resource other staff need
  // granular access to, so it's requireAdmin() (literal role check),
  // not checkPermission(resource, action) like every other split.
  // Sidebar.tsx already hides the "Profile" nav link the same way
  // (isAdmin-gated), so all three layers agree.
  const session = await requireAdmin();
  if (!session) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        You do not have permission to view this page.
      </div>
    );
  }

  // admin/layout.tsx already fetched this same session for the shell's
  // own gate — no new query needed here beyond requireAdmin()'s own
  // lookup. Seeding the client with it replaces the old "adjust state
  // when user.id changes" render-time trick with the same prop-seeding
  // pattern every other split uses.
  return (
    <ProfileClient
      initialName={session.user.name || ""}
      initialEmail={session.user.email || ""}
    />
  );
}
