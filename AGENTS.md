<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Media storage: Garage (S3-compatible), not ImageKit

All media (product images, videos, site banners) is uploaded, fetched, and deleted through
**`lib/services/mediaService.ts`** — the single file that talks to storage. It uploads to a
self-hosted Garage S3-compatible bucket (see `GARAGE_*` vars in `.env`). If the CDN/storage
provider ever changes again, this is the only file that should need new logic — every route and
component goes through `MediaService`, never a storage SDK directly.

Public URLs look like `https://octetit-uploads.cdn.octetit.com/<fileKey>` (flat bucket root, no
folders). `ik.imagekit.io` URLs still in the database are legacy rows from before this migration —
do not write new code that uploads to or reads from ImageKit. `NEXT_PUBLIC_IMAGEKIT_*` /
`IMAGEKIT_PRIVATE_KEY` env vars are dead and unused; do not wire them up.
