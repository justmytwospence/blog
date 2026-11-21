/**
 * Site-wide constants shared by metadata, feeds, and routes.
 * Keep this module dependency-free (no fs, no React) so it can be
 * imported from server routes and app/layout.tsx alike.
 */
export const SITE_URL = 'https://www.spencerboucher.com';
/**
 * Origin that feed and entry ids were first published under. Ids are identity, not links, so they
 * stay here: moving them with SITE_URL would make every reader show every entry as new.
 */
export const FEED_ID_ORIGIN = 'https://spencerboucher.com';
export const SITE_NAME = 'Data Spencer';
export const SITE_DESCRIPTION =
  'Personal data science portfolio and blog showcasing projects, analyses, and insights';
export const AUTHOR = {
  name: 'Spencer Boucher',
  link: SITE_URL,
};
