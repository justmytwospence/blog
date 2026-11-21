/** Whether a nav link is the current section: its own path or anything beneath it. `/` matches only the home page. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
