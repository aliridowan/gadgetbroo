import DOMPurify from "isomorphic-dompurify";

/**
 * The single place that decides what HTML from a rich-text editor is safe
 * to store and render. Used both server-side (product/page write routes —
 * the primary defense, since that's the one choke point ALL rich content
 * passes through) and client-side (ProductDetailsClient, PolicyViewer — a
 * second, cheap layer against a direct DB edit or a future write path that
 * forgets to sanitize). `isomorphic-dompurify` wraps DOMPurify + jsdom so
 * the exact same call works identically in both environments.
 *
 * The allowlist matches exactly what components/admin/TiptapEditor.tsx's
 * StarterKit + toolbar can actually produce — nothing else survives.
 * IMPORTANT: if TiptapEditor ever gains new extensions (links, images,
 * tables, etc.), this allowlist has to grow with it here, or the new
 * feature's output will be silently stripped on save.
 */
const ALLOWED_TAGS = [
  "p", "strong", "em", "s", "code", "pre",
  "blockquote", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "br", "hr",
];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  });
}
