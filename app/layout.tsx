import type { Metadata } from "next";
import { Inter, Merriweather } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Navigation } from "@/components/Navigation";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const merriweather = Merriweather({ 
  weight: ["300", "400", "700"],
  subsets: ["latin"],
  variable: "--font-merriweather"
});

const SITE_NAME = "Data Spencer";
const SITE_DESCRIPTION =
  "Personal data science portfolio and blog showcasing projects, analyses, and insights";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  keywords: ["data science", "machine learning", "portfolio", "blog", "analytics"],
  authors: [{ name: "Spencer Boucher" }],
  creator: "Spencer Boucher",
  openGraph: {
    type: "website",
    locale: "en_US",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="alternate"
          type="application/rss+xml"
          title="RSS Feed"
          href="/feed.xml"
        />
        <link
          rel="alternate"
          type="application/atom+xml"
          title="Atom Feed"
          href="/atom.xml"
        />
        <link rel="human-json" href="/human.json" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Blogroll"
          href="/blogroll.xml"
        />
      </head>
      <body className={`${inter.variable} ${merriweather.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <div className="flex flex-col min-h-screen bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-[#d4d4d4] transition-colors duration-200">
            <Navigation />
            <div className="flex-1 pb-20 sm:pb-0">
              {children}
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
