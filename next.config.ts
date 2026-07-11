import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Defense-in-depth for user-uploaded logos: even if a malicious SVG
        // slipped past sanitization, these headers stop it from executing
        // as active content when the URL is opened directly.
        source: "/uploads/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "script-src 'none'; sandbox" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
