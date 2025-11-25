'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';

export function Navigation() {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/projects', label: 'Projects' },
    { href: '/blog', label: 'Blog' },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop nav - sticky top */}
      <nav className="hidden sm:block sticky top-0 z-50 border-b border-gray-200 dark:border-[#303031] bg-white dark:bg-[#252526] transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Desktop Navigation Links */}
            <div className="flex space-x-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors duration-200 ${
                    isActive(link.href)
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                      : 'text-gray-700 dark:text-[#cccccc] hover:text-gray-900 dark:hover:text-[#d4d4d4] border-b-2 border-transparent hover:border-gray-300 dark:hover:border-[#454545]'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right side: RSS Feed & Theme Toggle */}
            <div className="flex items-center space-x-2">
              <a
                href="/feed.xml"
                className="flex items-center justify-center p-2 rounded-lg bg-gray-200 dark:bg-[#252526] hover:bg-gray-300 dark:hover:bg-[#3a3d41] transition-colors duration-200"
                title="RSS Feed"
                aria-label="RSS Feed"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 text-gray-700 dark:text-yellow-500"
                >
                  <path d="M3.75 3a.75.75 0 0 0-.75.75v.5c0 .414.336.75.75.75H4a9 9 0 0 1 9 9v.25c0 .414.336.75.75.75h.5a.75.75 0 0 0 .75-.75V14c0-6.075-4.925-11-11-11h-.25Z" />
                  <path d="M3 7.75A.75.75 0 0 1 3.75 7H4a6 6 0 0 1 6 6v.25a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75V13a4 4 0 0 0-4-4h-.25A.75.75 0 0 1 3 8.25v-.5Z" />
                  <path d="M6 14a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
                </svg>
              </a>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile nav - fixed bottom bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 dark:border-[#303031] bg-white dark:bg-[#252526] transition-colors duration-200 safe-area-bottom">
        <div className="flex justify-around items-center h-16 px-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center flex-1 py-2 text-xs font-medium transition-colors duration-200 ${
                isActive(link.href)
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-[#a6a6a6]'
              }`}
            >
              {link.label === 'Home' && (
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              )}
              {link.label === 'About' && (
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
              {link.label === 'Projects' && (
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              )}
              {link.label === 'Blog' && (
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              )}
              <span>{link.label}</span>
            </Link>
          ))}
          {/* Theme toggle in mobile nav */}
          <ThemeToggle variant="mobile" />
        </div>
      </nav>
    </>
  );
}
