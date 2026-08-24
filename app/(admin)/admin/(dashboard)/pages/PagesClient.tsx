"use client";

import React, { useState, useEffect, useRef } from 'react';
import TiptapEditor from '@/components/admin/TiptapEditor';
import { toast } from 'sonner';

const PAGES = [
  { slug: 'privacy-policy', label: 'Privacy Policy' },
  { slug: 'terms-conditions', label: 'Terms & Conditions' },
  { slug: 'return-policy', label: 'Return Policy' },
];

// Must match the server's default fetch in page.tsx (slug="privacy-policy",
// language="en") so the very first client render already agrees with what
// was server-rendered.
const DEFAULT_SLUG = 'privacy-policy';
const DEFAULT_LANGUAGE: 'en' | 'bn' = 'en';

export default function PagesClient({
  initialContent,
  initialUpdatedAt,
}: {
  initialContent: string;
  initialUpdatedAt: string | null;
}) {
  const [selectedSlug, setSelectedSlug] = useState(DEFAULT_SLUG);
  const [language, setLanguage] = useState<'en' | 'bn'>(DEFAULT_LANGUAGE);
  const [content, setContent] = useState(initialContent);
  const [lastUpdated, setLastUpdated] = useState<string | null>(initialUpdatedAt);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPage = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/pages?slug=${selectedSlug}&language=${language}`);
      const data = await res.json();
      if (res.ok && data.page) {
        setContent(data.page.content);
        setLastUpdated(new Date(data.page.updatedAt).toLocaleDateString());
      } else {
        setContent(''); // Reset if not found
        setLastUpdated(null);
      }
    } catch (error) {
      toast.error('Failed to load page content');
    } finally {
      setIsLoading(false);
    }
  };

  // The server already fetched data matching the defaults above
  // (slug="privacy-policy", language="en"), so skip the very first effect
  // run — it would just re-request the exact same page.
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    fetchPage();
  }, [selectedSlug, language]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: selectedSlug,
          language,
          content,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save');
      }

      const data = await res.json();
      setLastUpdated(new Date(data.page.updatedAt).toLocaleDateString());
      toast.success('Page saved successfully!');
    } catch (error) {
      toast.error('Failed to save page');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">Page Editor</h1>

      <div className="bg-card border border-border rounded-xl p-6">

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="space-y-4">
            <select
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              className="bg-background border border-border text-foreground rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 font-normal text-sm w-full sm:w-auto"
            >
              {PAGES.map((page) => (
                <option key={page.slug} value={page.slug}>
                  {page.label}
                </option>
              ))}
            </select>

            <div className="flex bg-background border border-border rounded-lg p-1 w-fit">
              <button
                onClick={() => setLanguage('en')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${language === 'en' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('bn')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${language === 'bn' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                বাংলা
              </button>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {lastUpdated && (
          <p className="text-xs text-muted-foreground mb-4 font-mono">
            Last Updated: {lastUpdated}
          </p>
        )}

        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 bg-card/50 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-lg border border-border">
              <span className="text-blue-500 font-medium animate-pulse">Loading...</span>
            </div>
          )}
          <TiptapEditor content={content} onChange={setContent} />
        </div>
      </div>
    </div>
  );
}
