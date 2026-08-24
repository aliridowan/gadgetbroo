"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, KeyRound, UserCircle2, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { passwordSchema } from "@/zodSchemas/passwordSchema";

interface ProfileClientProps {
  initialName: string;
  initialEmail: string;
}

export default function ProfileClient({ initialName, initialEmail }: ProfileClientProps) {
  const router = useRouter();
  // Still used for the role badge display — role/permissions aren't
  // something this page edits, just shows, so no need to duplicate
  // that fetch server-side too.
  const { fullUser } = useAuthSession();

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [savingDetails, setSavingDetails] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDetails(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");
      toast.success("Profile updated successfully");
      // The storefront Navbar renders this same session's name/email
      // server-side (components/navbar.tsx) — without this, it'd keep
      // showing the old value until a manual refresh, same root cause
      // as the sign-in/sign-up navbar fix.
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setSavingDetails(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    const passCheck = passwordSchema.safeParse(newPassword);
    if (!passCheck.success) {
      toast.error(passCheck.error.issues[0].message);
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");

      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 mt-2">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
          Admin Profile
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your personal details and security settings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Profile Details Form */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-blue-500/10 rounded-lg text-blue-400">
              <UserCircle2 size={20} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Personal Details</h2>
              <p className="text-[11px] text-muted-foreground">Update your name and email address</p>
            </div>
          </div>

          <form onSubmit={handleUpdateDetails} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs text-muted-foreground">Full Name</Label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9 bg-card/50 border-border text-foreground"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">Email Address</Label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 bg-card/50 border-border text-foreground"
                  required
                />
              </div>
            </div>

            {fullUser?.role && (
               <div className="pt-2">
                 <Label className="text-xs text-muted-foreground mb-1.5 block">Current Role</Label>
                 <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                   {fullUser.role.name}
                 </span>
               </div>
            )}

            <Button
              type="submit"
              disabled={savingDetails || (name === initialName && email === initialEmail)}
              className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
            >
              {savingDetails ? <Loader2 size={16} className="animate-spin" /> : "Save Details"}
            </Button>
          </form>
        </div>

        {/* Security / Password Form */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-emerald-500/10 rounded-lg text-emerald-400">
              <KeyRound size={20} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Security</h2>
              <p className="text-[11px] text-muted-foreground">Change your account password</p>
            </div>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4" autoComplete="off">
            {/* Fake inputs to trap aggressive browser autofill */}
            <input type="text" name="fakeusernameremembered" style={{display: 'none'}} />
            <input type="password" name="fakepasswordremembered" style={{display: 'none'}} />

            <div className="space-y-1.5">
              <Label htmlFor="current-password" className="text-xs text-muted-foreground">Current Password</Label>
              <PasswordInput
                id="current-password"
                name="current_password_input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="bg-card/50 border-border text-foreground"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs text-muted-foreground">New Password</Label>
              <PasswordInput
                id="new-password"
                name="new_password_input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="bg-card/50 border-border text-foreground"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs text-muted-foreground">Confirm New Password</Label>
              <PasswordInput
                id="confirm-password"
                name="confirm_password_input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="bg-card/50 border-border text-foreground"
                autoComplete="new-password"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-foreground transition-all"
            >
              {savingPassword ? <Loader2 size={16} className="animate-spin" /> : "Update Password"}
            </Button>
          </form>
        </div>

      </div>
    </div>
  );
}
