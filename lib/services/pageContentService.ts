import prisma from "@/lib/prisma";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

export type PageContent = {
  id: string;
  slug: string;
  language: string;
  content: string;
  updatedAt: Date;
};

/**
 * PageContentService — single source of truth for reading/writing the
 * admin-editable legal/policy pages (privacy-policy, terms-conditions,
 * return-policy, each in "en"/"bn"). Called both by GET/POST /api/pages
 * (client-side load/save from the Tiptap editor) and directly by
 * pages/page.tsx (initial page load), same reasoning as the other admin
 * *Service modules.
 */
export const PageContentService = {
  async getPage(slug: string, language: string): Promise<PageContent | null> {
    return prisma.page.findUnique({
      where: { slug_language: { slug, language } },
    });
  },

  /**
   * Sanitization lives here, not in the route — this is the one function
   * every save (API route today, anything else later) goes through, so
   * it's the one place that has to remember to strip anything the
   * TiptapEditor toolbar can't actually produce before it reaches the DB.
   * See lib/sanitizeHtml.ts for what's allowed and why.
   */
  async savePage(slug: string, language: string, content: string): Promise<PageContent> {
    const sanitizedContent = sanitizeHtml(content);

    return prisma.page.upsert({
      where: { slug_language: { slug, language } },
      update: { content: sanitizedContent },
      create: { slug, language, content: sanitizedContent },
    });
  },
};
