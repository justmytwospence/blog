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

const nextConfig = {
  transpilePackages: [
    '@blog/hardcover',
    '@blog/inoreader',
    '@blog/obsidian-md',
    '@blog/strava',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.hardcover.app' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
    ],
  },
  async redirects() {
    return [
      { source: '/projects/vertfarmer', destination: '/projects/uphill-ski', permanent: true },
      { source: '/projects/effort-cubes', destination: '/projects/effort-curve', permanent: true },
      { source: '/projects/lean-context', destination: '/projects/cache-guard', permanent: true },
      { source: '/projects/auto-effort', destination: '/projects/pi-system1', permanent: true },
      { source: '/projects/herdr-machine0', destination: '/projects', permanent: false },
      { source: '/projects/herdr-repeat-navigation', destination: '/projects', permanent: false },
      { source: '/projects/anthropic-billing-guard', destination: '/projects', permanent: false },
      // Concepts became ordinary blog posts; keep the old URLs working.
      { source: '/concepts', destination: '/blog', permanent: true },
      { source: '/concepts/:slug', destination: '/blog/:slug', permanent: true },
    ];
  },
  async headers() {
    const headers = process.env.VERCEL_ENV === 'production'
      ? securityHeaders
      : [...securityHeaders, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
    // The embedded Lorenz atlas (public/gini) is framed by the blog post, so it may be framed by this origin only.
    return [
      { source: '/:path*', headers },
      { source: '/gini/:path*', headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
    ];
  },
};

export default nextConfig;
