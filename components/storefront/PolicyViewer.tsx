"use client";

import React, { useState } from 'react';
import { sanitizeHtml } from '@/lib/sanitizeHtml';

interface PolicyViewerProps {
  title: { en: string, bn: string };
  contentEn: string;
  contentBn: string;
}

export default function PolicyViewer({ title, contentEn, contentBn }: PolicyViewerProps) {
  const [lang, setLang] = useState<'en' | 'bn'>('en');

  const content = lang === 'en' ? contentEn : contentBn;
  const currentTitle = lang === 'en' ? title.en : title.bn;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-slate-300">
      
      {/* Header & Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-bold text-white">{currentTitle}</h1>
        
        <div className="flex bg-[#0a0a0a] border border-slate-700 rounded-lg p-1">
          <button
            onClick={() => setLang('en')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              lang === 'en' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLang('bn')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              lang === 'bn' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            বাংলা
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div 
        className="prose prose-invert prose-blue max-w-none prose-headings:text-white prose-a:text-blue-400 hover:prose-a:text-blue-300"
        dangerouslySetInnerHTML={{ __html: content ? sanitizeHtml(content) : `<p>Content not available in this language yet.</p>` }}
      />

    </div>
  );
}
