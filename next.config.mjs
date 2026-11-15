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
  async headers() {
    const headers = process.env.VERCEL_ENV === 'production'
      ? securityHeaders
      : [...securityHeaders, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
    return [{ source: '/:path*', headers }];
  },
};

export default nextConfig;
