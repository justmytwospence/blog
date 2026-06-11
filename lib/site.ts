/**
 * Site-wide constants shared by metadata, feeds, and routes.
 * Keep this module dependency-free (no fs, no React) so it can be
 * imported from server routes and app/layout.tsx alike.
 */
export const SITE_URL = 'https://spencerboucher.com';
export const SITE_NAME = 'Data Spencer';
export const SITE_DESCRIPTION =
  'Personal data science portfolio and blog showcasing projects, analyses, and insights';
export const AUTHOR = {
  name: 'Spencer Boucher',
  link: SITE_URL,
};
