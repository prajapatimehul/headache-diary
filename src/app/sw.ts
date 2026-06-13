import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, CacheFirst, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Procedural 3D head ships no .glb, but keep the rule for any 3D assets.
      matcher: ({ url }) => /\.(?:glb|gltf|bin|hdr|ktx2)$/i.test(url.pathname),
      handler: new CacheFirst({ cacheName: "3d-assets" }),
    },
    {
      matcher: ({ url }) => url.hostname.endsWith(".supabase.co"),
      handler: new NetworkFirst({ cacheName: "supabase", networkTimeoutSeconds: 5 }),
    },
    {
      matcher: ({ request }) =>
        request.destination === "font" || request.destination === "image",
      handler: new StaleWhileRevalidate({ cacheName: "static-media" }),
    },
    ...defaultCache, // spread LAST so custom matchers win
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
