import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 session proxy (the rename of `middleware.ts` → `proxy.ts`,
 * `middleware()` → `proxy()`). Runs on the Node.js runtime only (edge unsupported).
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except the ones below, so the service worker,
     * PWA manifest, and static/3D assets are never gated behind auth:
     *   - _next/static, _next/image
     *   - favicon.ico, the web manifest, sw.js
     *   - image files (svg/png/jpg/jpeg/gif/webp) and .glb 3D assets
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb)$).*)",
  ],
};
