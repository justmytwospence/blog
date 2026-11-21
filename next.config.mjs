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
    '@blog/notebook-parser',
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
  // Concepts became ordinary blog posts; keep the old URLs working.
  async redirects() {
    return [
      // gini.spencerboucher.com is bound to the inequality-atlas preview branch; land on the post.
      { source: '/', has: [{ type: 'host', value: 'gini.spencerboucher.com' }], destination: '/blog/how-unequal-were-they', permanent: false },
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
