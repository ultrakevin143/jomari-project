import type { NextConfig } from "next";

const apiOrigin = process.env.API_ORIGIN || "http://127.0.0.1:4000";
const config: NextConfig = {
  distDir:
    process.env.WASTE_HUB_DIST_DIR === ".next-demo" ? ".next-demo" : ".next",
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
