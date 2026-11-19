import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/Toaster";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Meydan",
    template: "%s · Meydan",
  },
  description: "Türkçe topluluklar için sade, gerçek zamanlı sohbet.",
  applicationName: "Meydan",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "Meydan",
    title: "Meydan",
    description: "Türkçe topluluklar için sade, gerçek zamanlı sohbet.",
  },
  twitter: {
    card: "summary",
    title: "Meydan",
    description: "Türkçe topluluklar için sade, gerçek zamanlı sohbet.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
    { media: "(prefers-color-scheme: light)", color: "#f5f6fa" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={inter.variable} lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
