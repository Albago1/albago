import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow next/image to optimize photos served from Supabase Storage
  // (event-covers bucket). Other origins are blocked so a stray
  // <Image src="https://attacker.example/..."> can't be used
  // as an open image proxy.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
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
    ];
  },
};

export default nextConfig;
