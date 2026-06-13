import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client.
 *
 * `createBrowserClient` is a singleton internally, so it is safe to call this
 * helper on every render / in every client component. Uses the 2026
 * publishable key env var (`sb_publishable_...`), NOT the legacy anon JWT.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
