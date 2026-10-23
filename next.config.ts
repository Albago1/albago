import type { NextConfig } from "next";

// Short links for sharing the Kabayel vs Hysa fight on social media:
// albago.org/fight, plus one per platform so the UTM tags (saved with every
// visit and shop click in `interactions`) show which platform brought people.
const FIGHT_PAGE = "/events/kabayel-vs-hysa-wbc-world-heavyweight-championship-9257ab74";
const fightLink = (source: string | null) =>
  `${FIGHT_PAGE}?${source ? `utm_source=${source}&utm_medium=social` : "utm_medium=short_link"}&utm_campaign=kabayel-hysa`;
const FIGHT_LINKS: Array<[string, string | null]> = [
  ["/fight", null],
  ["/fight/ig", "instagram"],
  ["/fight/tt", "tiktok"],
  ["/fight/fb", "facebook"],
  ["/fight/wa", "whatsapp"],
];

const nextConfig: NextConfig = {
  // Allow next/image to optimize photos served from Supabase Storage
  // (event-covers bucket). Other origins are blocked so a stray
  // <Image src="https://attacker.example/..."> can't be used
  // as an open image proxy.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        // Only AlbaGo's own project; other Supabase-hosted pictures load directly.
        hostname: process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  async redirects() {
    return [
      // Protest, movement and volunteer pages were removed (Phase 41).
      // Old shared links land on event discovery instead of a 404.
      { source: "/protests", destination: "/events", permanent: false },
      { source: "/protests/:path*", destination: "/events", permanent: false },
      { source: "/events/albanian-revolution", destination: "/events", permanent: false },
      { source: "/events/albanian-revolution/:path*", destination: "/events", permanent: false },
      { source: "/movements/:path*", destination: "/events", permanent: false },
      { source: "/volunteer", destination: "/events", permanent: false },
      // Temporary, so a short link can be pointed elsewhere later.
      ...FIGHT_LINKS.map(([source, utm]) => ({ source, destination: fightLink(utm), permanent: false })),
    ];
  },
};

export default nextConfig;
