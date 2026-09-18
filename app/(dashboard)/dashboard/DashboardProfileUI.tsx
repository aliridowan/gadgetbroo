"use client";

import { format } from "date-fns";
import { User as UserIcon, Mail, Calendar, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function DashboardProfileUI({ fullUser }: { fullUser: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account details.</p>
      </div>

      <div className="bg-card border border-border/60 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-8">

        {/* Avatar Placeholder */}
        <div className="w-32 h-32 bg-muted rounded-full border-4 border-background flex items-center justify-center text-muted-foreground shadow-xl shrink-0">
          {/* <UserIcon size={48} /> */}
          {fullUser.image ? (
            // next/image — user.image is only ever set by better-auth
            // from Google OAuth (see next.config.ts's googleusercontent.com
            // remotePattern), never user- or admin-editable directly.
            // object-cover here is deliberate, unlike product photos: a
            // profile picture cropped to fill a circle is the expected,
            // standard avatar treatment, not a "hidden content" bug.
            <div className="relative flex items-center justify-center w-32 h-32 rounded-full bg-muted border border-border hover:ring-2 hover:ring-primary/50 outline-none transition-all">
              <Image
                src={fullUser.image}
                alt={fullUser.name || "User"}
                fill
                // sizes="32px"
                className="rounded-full object-cover"
              />
            </div>
          ) : (
            <UserIcon size={16} className="text-muted-foreground" />
          )}
        </div>
        {/* Info */}
        <div className="flex-1 space-y-4 text-center sm:text-left">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{fullUser.name}</h2>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground mt-1">
              <Mail size={14} />
              <span className="text-sm">{fullUser.email}</span>
              {!fullUser.emailVerified && (
                <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full border border-destructive/20 font-semibold uppercase tracking-wider ml-2">
                  Unverified
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/50">
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5 justify-center sm:justify-start">
                <Calendar size={12} /> Member Since
              </div>
              <div className="text-foreground font-medium">
                {format(new Date(fullUser.createdAt), "MMMM d, yyyy")}
              </div>
            </div>

            {fullUser.role && (
              <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5 justify-center sm:justify-start">
                  <Shield size={12} /> Account Role
                </div>
                <div className="text-primary font-medium capitalize flex items-center justify-center sm:justify-start gap-2">
                  {fullUser.role.name}
                  {fullUser.role.name.toLowerCase() === 'admin' && (
                    <Link href="/admin" className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded hover:bg-primary/90 transition-colors">
                      Admin Panel
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
