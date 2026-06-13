/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

// Self-hosted marimo WASM exports under /marimo/* are embedded in a same-origin
// <iframe> on /projects/[slug], so they must allow same-origin framing — the global
// X-Frame-Options: DENY would block them. (COOP/COEP are NOT needed: marimo WASM
// does not require cross-origin isolation unless using SharedArrayBuffer/threads.)
const marimoHeaders = securityHeaders.map((h) =>
  h.key === 'X-Frame-Options' ? { key: 'X-Frame-Options', value: 'SAMEORIGIN' } : h
);

const nextConfig = {
  transpilePackages: [
    '@blog/notebook-parser',
    '@blog/hardcover',
    '@blog/inoreader',
    '@blog/obsidian-md',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.hardcover.app' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
    ],
  },
  async headers() {
    return [
      // marimo WASM embeds: same-origin framing allowed (must precede the catch-all)
      { source: '/marimo/:path*', headers: marimoHeaders },
      // everything else keeps the strict defaults (incl. X-Frame-Options: DENY)
      { source: '/((?!marimo/).*)', headers: securityHeaders },
    ];
  },
};

export default nextConfig;
