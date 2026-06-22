import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import CookieConsent from "@/components/layout/CookieConsent";
import Footer from "@/components/layout/Footer";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { jsonLdScript, organizationSchema, websiteSchema } from "@/lib/seo/jsonLd";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://albago.org',
  ),
  title: {
    template: '%s | AlbaGo',
    default: 'AlbaGo — Discover Events, Movements & Nightlife',
  },
  description:
    'AlbaGo is a modern global platform for events, nightlife, civic movements, and public gatherings — peaceful, lawful, and worldwide.',
  openGraph: {
    title: 'AlbaGo — Events, Movements & Nightlife',
    description:
      'Discover events, venues, and civic gatherings across cities and continents.',
    siteName: 'AlbaGo',
    locale: 'en_US',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#050505',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink-950 text-white">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteSchema()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationSchema()) }}
        />
        <div className="pointer-events-none fixed inset-0 -z-10 bg-noise" />
        <LanguageProvider>
          <div className="flex min-h-full flex-1 flex-col pb-16 sm:pb-0">
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
          <MobileBottomNav />
        </LanguageProvider>
        <CookieConsent />
      </body>
    </html>
  );
}
