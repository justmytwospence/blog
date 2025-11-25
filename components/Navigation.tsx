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
    <nav className="sticky top-0 z-50 border-b border-gray-200 dark:border-[#303031] bg-white dark:bg-[#252526] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Navigation Links */}
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
  );
}
