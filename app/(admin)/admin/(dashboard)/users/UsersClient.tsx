// app/(admin)/admin/(dashboard)/users/UsersClient.tsx
"use client";

import { useState, useCallback } from "react";
import {
  Crown,
  Loader2,
  MoreHorizontal,
  Pencil,
  KeyRound,
  Trash2,
  Plus,
  UserCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { FullUser, RoleData } from "../../../../../lib/types";
import { CreateUserButton } from "../roles/HandleRoleAction";
import { DeleteUserButton } from "./HangleUserActions";
import { passwordSchema } from "@/zodSchemas/passwordSchema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "../../../../../components/password-input";

// ── Edit Role & Email Modal ───────────────────────────────────────────
function EditUserModal({
  user,
  roles,
  open,
  onOpenChange,
  onSuccess,
}: {
  user: FullUser;
  roles: RoleData[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState(user.email);
  const [roleId, setRoleId] = useState(user.roleId ?? "");
  const [prevUserId, setPrevUserId] = useState(user.id);
  const [saving, setSaving] = useState(false);

  // Sync state if user changes without cascading render
  if (user.id !== prevUserId) {
    setPrevUserId(user.id);
    setEmail(user.email);
    setRoleId(user.roleId ?? "");
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/user/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, roleId: roleId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      toast.success(`${user.name} updated successfully`);
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update email address and role for{" "}
            <span className="text-foreground font-medium">{user.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-role">Role</Label>
            <select
              id="edit-role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— No role —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Selecting &quot;admin&quot; grants full system access.
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Change Password Modal ─────────────────────────────────────────────
function ChangePasswordModal({
  user,
  open,
  onOpenChange,
}: {
  user: FullUser;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const passwordValidation = passwordSchema.safeParse(newPassword);
    if (!passwordValidation.success) {
      toast.error(passwordValidation.error.issues[0]?.message || "Invalid password");
      return;
    }
    if (newPassword !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/user/${user.id}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set password");
      toast.success(`Password updated for ${user.email}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const passwordResult = passwordSchema.safeParse(newPassword);
  const passwordError = newPassword && !passwordResult.success
    ? passwordResult.error.issues[0]?.message
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound size={16} />
            Change Password
          </DialogTitle>
          <DialogDescription>
            Administrative password override for{" "}
            <span className="text-foreground font-medium">{user.email}</span>.{" "}
            <span className="text-amber-400">
              This bypasses email verification and takes effect immediately.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New Password</Label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters with 1 special char"
              autoComplete="new-password"
            />
            {passwordError && (
              <p className="text-[11px] text-destructive">{passwordError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <PasswordInput
              id="confirm-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              autoComplete="new-password"
            />
            {confirm && newPassword !== confirm && (
              <p className="text-[11px] text-destructive">Passwords do not match</p>
            )}
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[11px] text-amber-400/80">
            ⚠ Only works for users who signed up with email &amp; password. OAuth users
            (Google, etc.) do not have a password record.
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !passwordResult.success || newPassword !== confirm}
              className="gap-2 bg-amber-600 hover:bg-amber-500 text-foreground"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              <KeyRound size={14} />
              Set Password
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Users Page ───────────────────────────────────────────────────
export default function UsersClient({
  initialUsers,
  initialRoles,
}: {
  initialUsers: FullUser[];
  initialRoles: RoleData[];
}) {
  const [usersData, setUsersData] = useState<FullUser[]>(initialUsers);
  const [roles, setRoles] = useState<RoleData[]>(initialRoles);
  // Starts false (unlike the original's `true`) since the server already
  // supplied both lists — no mount-time fetch happens here at all anymore.
  // fetchUsers below is only ever called after an actual mutation
  // (create/edit/delete user), and still toggles this exactly as before
  // for those calls.
  const [loading, setLoading] = useState(false);

  // Modal state
  const [editTarget, setEditTarget] = useState<FullUser | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<FullUser | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        fetch("/api/user", { cache: "no-store" }),
        fetch("/api/roles", { cache: "no-store" }),
      ]);

      const usersJson = await usersRes.json();
      const rolesJson = await rolesRes.json();

      if (!Array.isArray(usersJson.users)) throw new Error("Failed to fetch users");
      setUsersData(usersJson.users);
      if (Array.isArray(rolesJson.roles)) setRoles(rolesJson.roles);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mt-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            User Management
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage admin users, assign roles, and override credentials
          </p>
        </div>
        <CreateUserButton onSuccess={fetchUsers} roles={roles} />
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead className="border-b border-border text-muted-foreground text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Joined</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              {usersData.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                  {/* User column */}
                  <td className="px-5 py-3.5 font-medium text-foreground">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                        {user.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.image}
                            alt={user.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <UserCircle2 size={14} className="text-muted-foreground" />
                        )}
                      </div>
                      <span className="truncate max-w-[140px]">{user.name}</span>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-5 py-3.5 text-muted-foreground">{user.email}</td>

                  {/* Role badge */}
                  <td className="px-5 py-3.5">
                    {user.role ? (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${
                          user.role.name.toLowerCase() === "admin"
                            ? "text-cyan-400 border border-cyan-500/30 bg-cyan-500/10"
                            : "text-blue-300 border border-blue-500/30 bg-blue-600/20"
                        }`}
                      >
                        {user.role.name.toLowerCase() === "admin" && <Crown size={10} />}
                        {user.role.name}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-[11px]">No role</span>
                    )}
                  </td>

                  {/* Joined */}
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {format(new Date(user.createdAt), "d MMM yyyy")}
                  </td>

                  {/* Actions — "..." dropdown */}
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="User actions"
                          >
                            <MoreHorizontal size={15} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">
                            {user.email}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          {/* Edit Role & Email */}
                          <DropdownMenuItem
                            onClick={() => setEditTarget(user)}
                            className="gap-2 cursor-pointer"
                          >
                            <Pencil size={13} />
                            Edit Role &amp; Email
                          </DropdownMenuItem>

                          {/* Change Password */}
                          <DropdownMenuItem
                            onClick={() => setPasswordTarget(user)}
                            className="gap-2 cursor-pointer"
                          >
                            <KeyRound size={13} />
                            Change Password
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {/* Delete (uses existing AlertDialog component) */}
                          <div className="px-1 py-0.5">
                            <DeleteUserButton user={user} onSuccess={fetchUsers} />
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {usersData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <UserCircle2 size={32} className="opacity-40" />
            <p className="text-sm">No users yet</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {editTarget && (
        <EditUserModal
          user={editTarget}
          roles={roles}
          open={!!editTarget}
          onOpenChange={(v) => !v && setEditTarget(null)}
          onSuccess={fetchUsers}
        />
      )}
      {passwordTarget && (
        <ChangePasswordModal
          user={passwordTarget}
          open={!!passwordTarget}
          onOpenChange={(v) => !v && setPasswordTarget(null)}
        />
      )}
    </div>
  );
}
