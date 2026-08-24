"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Shield,
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { RoleData, Permission } from "../../../../../lib/types";
import { CreateRoleButton, DeleteRoleButton } from "./HandleRoleAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Resources that can be protected ──────────────────────────────────
const RESOURCES = [
  "Products",
  "Categories",
  "Orders",
  "POS",
  "Shipping",
  "Reviews",
  "Banners",
  "Pages",
  "Settings",
  "Media",
  "Users",
  "Roles"
] as const;
type Resource = (typeof RESOURCES)[number];

const PERM_COLS = [
  { key: "canView", label: "View" },
  { key: "canCreate", label: "Create" },
  { key: "canUpdate", label: "Update" },
  { key: "canDelete", label: "Delete" },
] as const;
type PermKey = "canView" | "canCreate" | "canUpdate" | "canDelete";

// Build a lookup: resource → permission object for a given role
function buildPermMap(permissions: Permission[]): Record<string, Permission> {
  return Object.fromEntries(permissions.map((p) => [p.resource, p]));
}

function getPermValue(
  permMap: Record<string, Permission>,
  resource: Resource,
  col: PermKey
): boolean {
  return permMap[resource]?.[col] ?? false;
}

// ── Permissions Matrix for a single role ─────────────────────────────
function PermissionsMatrix({
  role,
  onSaved,
}: {
  role: RoleData;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);

  // Build draft from role.permissions
  const buildDraft = (permissions: Permission[]) => {
    const permMap = buildPermMap(permissions);
    return Object.fromEntries(
      RESOURCES.map((r) => [
        r,
        {
          canView: getPermValue(permMap, r, "canView"),
          canCreate: getPermValue(permMap, r, "canCreate"),
          canUpdate: getPermValue(permMap, r, "canUpdate"),
          canDelete: getPermValue(permMap, r, "canDelete"),
        },
      ])
    ) as Record<Resource, Record<PermKey, boolean>>;
  };

  // Local draft — starts from DB state
  const [draft, setDraft] = useState<Record<Resource, Record<PermKey, boolean>>>(
    () => buildDraft(role.permissions)
  );

  // FIX 2: Re-sync draft whenever role.permissions changes (e.g., after fetchRoles)
  useEffect(() => {
    setDraft(buildDraft(role.permissions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role.permissions]);

  const toggle = (resource: Resource, col: PermKey) => {
    setDraft((prev) => ({
      ...prev,
      [resource]: { ...prev[resource], [col]: !prev[resource][col] },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const permissions = RESOURCES.map((resource) => ({
        resource,
        ...draft[resource],
      }));

      const res = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: role.id, permissions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save permissions");
      toast.success("Permissions saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-card">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-40">
                Resource
              </th>
              {PERM_COLS.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2.5 text-center font-medium text-muted-foreground w-20"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {RESOURCES.map((resource) => (
              <tr
                key={resource}
                className="bg-card hover:bg-card transition-colors"
              >
                <td className="px-4 py-2.5 font-medium text-muted-foreground">
                  {resource}
                </td>
                {PERM_COLS.map((col) => {
                  const checked = draft[resource][col.key];
                  return (
                    <td key={col.key} className="px-4 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggle(resource, col.key)}
                        aria-label={`Toggle ${col.label} for ${resource}`}
                        className={`w-5 h-5 rounded flex items-center justify-center mx-auto border transition-all duration-150 ${
                          checked
                            ? "bg-blue-600 border-blue-500 text-foreground"
                            : "border-border bg-card text-transparent hover:border-slate-500"
                        }`}
                      >
                        <Check size={11} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        >
          {saving ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Save size={13} />
          )}
          Save Permissions
        </Button>
      </div>
    </div>
  );
}

// ── Edit Role Name/Description inline ────────────────────────────────
function EditRoleInline({
  role,
  onSaved,
  onCancel,
}: {
  role: RoleData;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [saving, setSaving] = useState(false);
  const isLocked = role.name.toLowerCase() === "admin" || role.name === "customer";

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update role");
      toast.success("Role updated");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 mt-2">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Role name"
          disabled={isLocked}
          className="bg-background border-border text-foreground h-8 text-sm"
        />
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="bg-background border-border text-foreground h-8 text-sm flex-1"
        />
      </div>
      {isLocked && (
        <p className="text-[11px] text-amber-400">
          ⚠ The &quot;{role.name}&quot; role name is system-locked and cannot be changed.
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="text-muted-foreground h-7 text-xs"
        >
          <X size={12} className="mr-1" /> Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || isLocked}
          className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs gap-1"
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          Save
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function RolesClient({
  initialRoles,
}: {
  initialRoles: RoleData[];
}) {
  const [rolesData, setRolesData] = useState<RoleData[]>(initialRoles);
  // Starts false (unlike the original's `true`) since the server already
  // supplied the initial list — no mount-time fetch happens here at all
  // anymore. fetchRoles below is only ever called after an actual mutation
  // (create/edit/delete/permission-save), and still toggles this exactly
  // as before for those calls.
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/roles/", { cache: "no-store" });
      const data = await res.json();
      if (!Array.isArray(data.roles)) throw new Error("Bad response");
      setRolesData(data.roles);
    } catch {
      toast.error("Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setEditingId(null); // close edit when collapsing
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mt-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Roles &amp; Permissions
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage user roles and configure per-resource access permissions
          </p>
        </div>
        <CreateRoleButton onSuccess={fetchRoles} />
      </div>

      {/* Role Cards */}
      <div className="space-y-3">
        {rolesData.map((role) => {
          const isExpanded = expandedId === role.id;
          const isEditing = editingId === role.id;

          // Count the sum of individual enabled boolean values across all resource rows.
          // role.permissions.length counts ROWS (max 6), not enabled capabilities.
          const enabledPermCount = role.permissions.reduce(
            (sum, p) =>
              sum +
              (p.canView ? 1 : 0) +
              (p.canCreate ? 1 : 0) +
              (p.canUpdate ? 1 : 0) +
              (p.canDelete ? 1 : 0),
            0
          );

          return (
            <div
              key={role.id}
              className="border border-border rounded-xl bg-card overflow-hidden transition-all"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Shield size={14} className="text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      {role.name}
                      {(role.name.toLowerCase() === "admin" || role.name === "customer") && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">
                          system
                        </span>
                      )}
                    </h2>
                    {role.description && (
                      <p className="text-[11px] text-muted-foreground truncate">{role.description}</p>
                    )}
                    <div className="flex gap-3 text-[10px] text-slate-600 mt-0.5">
                      <span>{role._count.users} user{role._count.users !== 1 ? "s" : ""}</span>
                      <span>{enabledPermCount} permission{enabledPermCount !== 1 ? "s" : ""} enabled</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(isEditing ? null : role.id);
                      if (!isExpanded) setExpandedId(role.id);
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Edit role"
                  >
                    <Pencil size={14} />
                  </button>
                  <DeleteRoleButton role={role} onSuccess={fetchRoles} />
                  <button
                    type="button"
                    onClick={() => toggleExpand(role.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={isExpanded ? "Collapse" : "Configure permissions"}
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Expandable section */}
              {isExpanded && (
                <div className="border-t border-border px-5 pb-5">
                  {/* Edit form */}
                  {isEditing && (
                    <EditRoleInline
                      role={role}
                      onSaved={() => {
                        setEditingId(null);
                        fetchRoles();
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  )}

                  {/* Permissions matrix */}
                  <PermissionsMatrix
                    role={role}
                    onSaved={fetchRoles}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
