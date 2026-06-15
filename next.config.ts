import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
