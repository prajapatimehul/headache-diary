import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session-refresh logic, called from the root `proxy.ts`.
 *
 * Two hard rules (violating either causes random logouts — the #1 Supabase+Next bug):
 *   1. Do NOT run any code between `createServerClient(...)` and `getClaims()`.
 *   2. ALWAYS return `supabaseResponse` unmodified (or copy its cookies into any
 *      new response) — otherwise browser/server sessions desync.
 *
 * `getClaims()` (not `getSession()`) is used for the trust decision:
 * `getSession()` reads the cookie without verifying it server-side and can be spoofed.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // With Fluid compute, never hoist this client to a module-level/global var.
  // Always create a fresh one per request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do NOT run code between createServerClient and getClaims().
  // This refreshes the auth cookie for SIGNED-IN users so cloud sync keeps working.
  // The app is LOCAL-FIRST: anonymous users are NOT redirected — logging a
  // headache never requires an account. Sign-in is opt-in (for cross-device sync).
  await supabase.auth.getClaims();

  // You MUST return supabaseResponse unmodified (or copy cookies over)
  // or browser/server sessions desync and users get logged out.
  return supabaseResponse;
}
