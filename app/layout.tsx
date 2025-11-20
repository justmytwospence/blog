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

export const metadata: Metadata = {
  title: "Data Spencer",
  description: "Personal data science portfolio and blog showcasing projects, analyses, and insights",
  keywords: ["data science", "machine learning", "portfolio", "blog", "analytics"],
  authors: [{ name: "Portfolio Owner" }],
  creator: "Portfolio Owner",
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Data Science Portfolio",
    description: "Personal data science portfolio and blog showcasing projects, analyses, and insights",
    siteName: "Data Science Portfolio",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${merriweather.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <div className="flex flex-col min-h-screen bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-[#d4d4d4] transition-colors duration-200">
            <Navigation />
            <main className="flex-1">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
