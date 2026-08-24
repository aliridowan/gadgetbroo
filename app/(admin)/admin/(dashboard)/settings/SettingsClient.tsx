"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Upload, X, Image as ImageIcon, Lock } from 'lucide-react';
import { MediaPickerDialog, MediaFileRecord } from '@/components/admin/media/MediaPickerDialog';
import { useAuthSession, hasPermission } from '@/components/auth/AuthSessionProvider';

interface SettingsClientProps {
  initialBannerUrl: string | null;
  initialFaviconUrl: string | null;
  initialContactEmail: string;
  initialContactPhone: string;
  initialContactAddress: string;
}

export default function SettingsClient({
  initialBannerUrl,
  initialFaviconUrl,
  initialContactEmail,
  initialContactPhone,
  initialContactAddress,
}: SettingsClientProps) {
  const [bannerUrl, setBannerUrl] = useState<string | null>(initialBannerUrl);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(initialFaviconUrl);
  const [contactEmail, setContactEmail] = useState(initialContactEmail);
  const [contactPhone, setContactPhone] = useState(initialContactPhone);
  const [contactAddress, setContactAddress] = useState(initialContactAddress);

  const [isSaving, setIsSaving] = useState(false);

  // Media Picker State
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'banner' | 'favicon' | null>(null);

  // The layout already fetched fullUser.role.permissions once for the
  // whole admin shell (see AdminLayoutClient / AuthSessionProvider) — no
  // extra query needed here, same helper Sidebar.tsx uses for canView.
  // Super-admin ("admin" role) always passes, same rule checkPermission
  // enforces server-side.
  const { fullUser } = useAuthSession();
  const isAdmin = fullUser?.role?.name?.toLowerCase() === 'admin';
  const canUpdate = isAdmin || hasPermission(fullUser?.role?.permissions, 'Settings', 'canUpdate');

  const handleSave = async () => {
    if (!contactEmail || !contactPhone || !contactAddress) {
      toast.error('Please fill out all required contact fields');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bannerUrl,
          faviconUrl,
          contactEmail,
          contactPhone,
          contactAddress,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        if (errorData?.details) {
          // Extract the first validation error message to show in toast
          const firstErrorField = Object.values(errorData.details)[0] as string[];
          throw new Error(firstErrorField?.[0] || 'Validation failed');
        }
        throw new Error(errorData?.error || 'Failed to save');
      }

      await res.json();
      toast.success('Settings saved successfully!');
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMediaSelect = (selected: MediaFileRecord | MediaFileRecord[]) => {
    if (Array.isArray(selected)) return; // Only accept single selection
    if (pickerTarget === 'banner') {
      setBannerUrl(selected.url);
    } else if (pickerTarget === 'favicon') {
      setFaviconUrl(selected.url);
    }
    setPickerOpen(false);
  };

  const openPicker = (target: 'banner' | 'favicon') => {
    if (!canUpdate) return;
    setPickerTarget(target);
    setPickerOpen(true);
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

      {!canUpdate && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          <Lock size={16} />
          You have view-only access to Settings — changes are disabled.
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-6">

        {/* Banner Section */}
        <div className="mb-8 border-b border-border pb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Banner Logo</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Recommended: wide image (e.g., 1280x300px). PNG or SVG with transparent background works best. If removed, the storefront will display text.
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-full sm:w-64 h-24 bg-background border border-border rounded-lg flex items-center justify-center overflow-hidden relative group">
              {bannerUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bannerUrl} alt="Banner" className="w-full h-full object-contain p-2" />
                  {canUpdate && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <button onClick={() => setBannerUrl(null)} className="p-2 bg-red-600 rounded-full text-foreground hover:bg-red-500 transition">
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <ImageIcon size={24} className="mb-2" />
                  <span className="text-xs">No Banner</span>
                </div>
              )}
            </div>

            <button
              onClick={() => openPicker('banner')}
              disabled={!canUpdate}
              className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-secondary border border-border text-foreground rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-muted"
            >
              <Upload size={16} />
              Upload Image
            </button>
          </div>
        </div>

        {/* Favicon Section */}
        <div className="mb-8 border-b border-border pb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Favicon (Small Logo)</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Recommended: square image (e.g., 512x512px). Displayed on mobile views and small spaces. If removed, the storefront will display "GB".
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-24 h-24 bg-background border border-border rounded-lg flex items-center justify-center overflow-hidden relative group">
              {faviconUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={faviconUrl} alt="Favicon" className="w-full h-full object-contain p-2" />
                  {canUpdate && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <button onClick={() => setFaviconUrl(null)} className="p-2 bg-red-600 rounded-full text-foreground hover:bg-red-500 transition">
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <ImageIcon size={24} className="mb-2" />
                  <span className="text-xs">No Favicon</span>
                </div>
              )}
            </div>

            <button
              onClick={() => openPicker('favicon')}
              disabled={!canUpdate}
              className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-secondary border border-border text-foreground rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-muted"
            >
              <Upload size={16} />
              Upload Image
            </button>
          </div>
        </div>

        {/* Contact Info Section */}
        <div className="space-y-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground">Contact Information</h2>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Contact Email *</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              disabled={!canUpdate}
              className="w-full bg-background border border-border text-foreground rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="e.g. contact@gadgetbroo.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Contact Phone *</label>
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              disabled={!canUpdate}
              className="w-full bg-background border border-border text-foreground rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="e.g. +8801881835612"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Contact Address *</label>
            <textarea
              value={contactAddress}
              onChange={(e) => setContactAddress(e.target.value)}
              rows={3}
              disabled={!canUpdate}
              className="w-full bg-background border border-border text-foreground rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Full physical address"
              required
            />
          </div>
        </div>

        <div>
          <button
            onClick={handleSave}
            disabled={isSaving || !canUpdate}
            title={!canUpdate ? "You don't have permission to update Settings" : undefined}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

      </div>

      {canUpdate && (
        <MediaPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={handleMediaSelect}
          multiple={false}
          allowedTypes="image"
        />
      )}
    </div>
  );
}
