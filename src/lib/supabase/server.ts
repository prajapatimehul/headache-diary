import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Supabase client for Server Components / Server Actions / Route Handlers.
 *
 * `cookies()` is awaited (Next 15+). The try/catch around `setAll` is required
 * because Server Components cannot write cookies — the proxy (`updateSession`)
 * performs the actual session-refresh cookie write on every request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored — the proxy refreshes user sessions.
          }
        },
      },
    },
  );
}
