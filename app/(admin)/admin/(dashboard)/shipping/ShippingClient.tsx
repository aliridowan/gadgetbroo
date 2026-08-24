"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useAuthSession, hasPermission } from "@/components/auth/AuthSessionProvider";
import {
  CreateShippingZoneButton,
  EditShippingZoneButton,
  DeleteShippingZoneButton,
  ShippingZoneData,
} from "./HandleShippingAction";

interface ShippingClientProps {
  initialZones: ShippingZoneData[];
}

export default function ShippingClient({ initialZones }: ShippingClientProps) {
  const [zones, setZones] = useState<ShippingZoneData[]>(initialZones);
  // Seeded false — the server already fetched the initial list. This still
  // toggles true/false around every post-mutation refetch below, same as
  // the original: every create/edit/delete replaces the whole table with
  // this spinner while it reloads, not just a button-level state.
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { fullUser } = useAuthSession();
  const isAdmin = fullUser?.role?.name?.toLowerCase() === "admin";
  const canCreate = isAdmin || hasPermission(fullUser?.role?.permissions, "Shipping", "canCreate");
  const canUpdate = isAdmin || hasPermission(fullUser?.role?.permissions, "Shipping", "canUpdate");
  const canDelete = isAdmin || hasPermission(fullUser?.role?.permissions, "Shipping", "canDelete");

  const fetchZones = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/shipping-zones");
      if (!res.ok) throw new Error();
      const result = await res.json();
      if (result.success) {
        setZones(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch {
      toast.error("Failed to load shipping zones");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  const filteredZones = zones.filter(
    (zone) =>
      zone.cityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      zone.stateName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Shipping Zones
          </h1>
          {canCreate && <CreateShippingZoneButton onSuccess={fetchZones} />}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Search by city or state..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card/80 border-border text-foreground placeholder:text-muted-foreground w-full sm:max-w-md"
          />
        </div>

        <div className="bg-card/80 border border-border rounded-xl overflow-hidden shadow-xl backdrop-blur-sm">

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-muted-foreground text-sm font-medium border-b border-border">
                  <th className="py-4 px-6">State / Division</th>
                  <th className="py-4 px-6">City / Area</th>
                  <th className="py-4 px-6">Delivery Fee</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredZones.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted-foreground">
                      No shipping zones found.
                    </td>
                  </tr>
                ) : filteredZones.map((zone) => (
                  <tr key={zone.id} className="hover:bg-muted transition-colors">
                    <td className="py-4 px-6 font-medium text-foreground">{zone.stateName}</td>
                    <td className="py-4 px-6 text-muted-foreground">{zone.cityName}</td>
                    <td className="py-4 px-6 font-semibold text-foreground">
                      ৳{Number(zone.deliveryFee).toFixed(2)}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${zone.isActive
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                        }`}>
                        {zone.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {canUpdate && <EditShippingZoneButton zone={zone} onSuccess={fetchZones} />}
                        {canDelete && <DeleteShippingZoneButton zone={zone} onSuccess={fetchZones} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="block md:hidden divide-y divide-border">
            {filteredZones.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground text-sm">No shipping zones found.</p>
            ) : filteredZones.map((zone) => (
              <div key={zone.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{zone.cityName}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{zone.stateName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canUpdate && <EditShippingZoneButton zone={zone} onSuccess={fetchZones} />}
                    {canDelete && <DeleteShippingZoneButton zone={zone} onSuccess={fetchZones} />}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${zone.isActive
                      ? "bg-green-500/10 text-green-400"
                      : "bg-gray-500/10 text-gray-400"
                    }`}>
                    {zone.isActive ? "Active" : "Inactive"}
                  </span>
                  <span className="font-semibold text-foreground">
                    ৳{Number(zone.deliveryFee).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
