import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The browser opens 127.0.0.1 while the dev server reports localhost.
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
