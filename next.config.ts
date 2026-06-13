import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: false, // don't force-refresh mid-entry
  disable: process.env.NODE_ENV === "development", // avoid stale-cache in dev
});

const nextConfig: NextConfig = {
  // Turbopack is the default bundler in Next 16 (dev + build) — no --turbopack flag.
  // Add config under `turbopack` only if you need custom rules/aliases.
  turbopack: {},
};

export default withSerwist(nextConfig);
