import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    authInterrupts: true,
    // proxy.ts matches /api/media/:path* for rate limiting, and Next.js buffers
    // proxied request bodies up to this limit (default 10MB) before silently
    // truncating them. Media uploads now stream the raw file through /api/media/upload
    // server-side (up to 100MB for video), so this must cover that.
    proxyClientMaxBodySize: "110mb",
  },
  images: {
    // This network resolves octetit-uploads.cdn.octetit.com through a NAT64/DNS64
    // gateway to a synthesized IPv6 address (64:ff9b::/96 prefix wrapping the real
    // public IPv4). Next 16's built-in SSRF guard resolves the upstream host and
    // rejects it if any resolved address looks private/local, and it treats that
    // NAT64-synthesized address as private even though it maps to a public IP.
    // remotePatterns below already restricts fetches to specific known hosts we
    // control, so this extra DNS-based check is redundant here — safe to disable.
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      { protocol: "https", hostname: "ik.imagekit.io" }, // legacy assets uploaded before the Garage migration
      { protocol: "https", hostname: "gadgetbroo.cdn.octetit.com" },
      { protocol: "https", hostname: "octetit-uploads.cdn.octetit.com" }, // matches GARAGE_PUBLIC_URL
      { protocol: "https", hostname: "s3api.octetit.com" }, // matches GARAGE_ENDPOINT (fallback if GARAGE_PUBLIC_URL is unset)
      // Google OAuth profile photos (session.user.image, shown in the navbar
      // avatar) — better-auth's socialProviders.google is enabled, and this
      // field is never user- or admin-editable through any form in this app,
      // so Google's own CDN is the only source it can ever contain. Wildcard
      // subdomain since Google serves these from lh1-lh6.googleusercontent.com
      // depending on account/region, not a single fixed host.
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "www.startech.com.bd" },
      { protocol: "https", hostname: "gadgetbreeze.com.bd" },
    ],
  },
};

export default nextConfig;
