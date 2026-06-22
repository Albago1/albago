import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow next/image to optimize photos served from Supabase Storage
  // (event-covers + placard-photos buckets). Other origins are blocked
  // so a stray <Image src="https://attacker.example/..."> can't be used
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
      // Public URL pinned to the year — keep the bare slug working for any
      // pre-share links that pointed there.
      {
        source: "/protests/edi-rama-berlin",
        destination: "/protests/edi-rama-berlin-2026",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
