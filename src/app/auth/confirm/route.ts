import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * The route every sign-in link lands on. Supabase can send TWO link shapes
 * depending on the email template, and we accept both so a link works no
 * matter how the project is configured:
 *
 *  1. token_hash (recommended, cross-device safe) — custom template:
 *       {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 *     Verified server-side with `verifyOtp` — no client secret needed, so the
 *     link opens on ANY device.
 *
 *  2. code (PKCE, default template) — Supabase's /auth/v1/verify redirects to
 *       {redirect_to}?code=<auth_code>
 *     Exchanged with `exchangeCodeForSession`. Requires the code_verifier
 *     cookie set when the link was requested, so it must open in the SAME
 *     browser that requested it.
 *
 * Supabase may also bounce back here with ?error=...&error_code=otp_expired
 * when a link is genuinely stale — those fall through to the error page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  // Only allow same-site relative paths (avoid open redirect via ?next=).
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//")
    ? nextParam
    : "/";

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) redirect(next);
    console.error("[auth/confirm] verifyOtp failed:", error.message);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
    console.error("[auth/confirm] exchangeCodeForSession failed:", error.message);
  } else {
    const err = searchParams.get("error_description") ?? searchParams.get("error");
    console.error("[auth/confirm] no token_hash or code on callback", err ?? "");
  }

  redirect("/auth/auth-code-error");
}
