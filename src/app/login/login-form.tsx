"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Mail,
  Lock,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Mode = "login" | "signup";
type MagicStatus = "idle" | "sending" | "sent";

const inputClass =
  "h-12 w-full rounded-xl border border-border bg-card pr-3.5 pl-10 text-base text-foreground shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magic, setMagic] = useState<MagicStatus>("idle");
  const reduce = useReducedMotion();

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const supabase = createClient();
    try {
      const { error } =
        mode === "signup"
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Hard navigation so the proxy + server components pick up the new session.
      window.location.assign("/");
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)) || "";
      if (/invalid login credentials/i.test(msg)) {
        setError("Wrong email or password.");
      } else if (/already registered|already been registered|user already/i.test(msg)) {
        setError("That email already has an account — switching you to log in.");
        setMode("login");
      } else if (/password should be at least|at least 6/i.test(msg)) {
        setError("Password must be at least 6 characters.");
      } else if (/email.*invalid|invalid.*email/i.test(msg)) {
        setError("That email doesn't look right.");
      } else {
        setError(msg || "Something went wrong. Try again.");
      }
      setBusy(false);
    }
  }

  async function sendMagicLink() {
    if (!email) {
      setError("Enter your email first, then tap the magic-link option.");
      return;
    }
    setError(null);
    setMagic("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    if (error) {
      setError(error.message);
      setMagic("idle");
    } else {
      setMagic("sent");
    }
  }

  // ---- Magic-link "check your email" screen (fallback path) ----
  if (magic === "sent") {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
        className="space-y-5 text-center"
        aria-live="polite"
      >
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <CheckCircle2 className="size-7" aria-hidden />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Check your email
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We sent a sign-in link to{" "}
            <span className="font-medium text-foreground">{email}</span>.{" "}
            <span className="font-medium text-foreground">
              Open it on this device
            </span>{" "}
            (the same browser) to continue.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="h-11 w-full text-muted-foreground"
          onClick={() => {
            setMagic("idle");
            setError(null);
          }}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>
      </motion.div>
    );
  }

  const isSignup = mode === "signup";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
      className="space-y-4"
    >
      <form onSubmit={submitPassword} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={busy}
              aria-invalid={error ? true : undefined}
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="text-sm font-medium text-foreground"
          >
            Password
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? "At least 6 characters" : "Your password"}
              disabled={busy}
              aria-invalid={error ? true : undefined}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              tabIndex={-1}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPw ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={busy}
          className="h-12 w-full text-base"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {isSignup ? "Creating account…" : "Logging in…"}
            </>
          ) : isSignup ? (
            "Create account"
          ) : (
            "Log in"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {isSignup ? "Already have an account?" : "New here?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(isSignup ? "login" : "signup");
            setError(null);
          }}
          className="font-medium text-primary"
        >
          {isSignup ? "Log in" : "Create one"}
        </button>
      </p>

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={magic === "sending" || busy}
        onClick={sendMagicLink}
        className="h-12 w-full text-base"
      >
        {magic === "sending" ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Sending link…
          </>
        ) : (
          <>
            <Mail className="size-4" aria-hidden />
            Email me a magic link instead
          </>
        )}
      </Button>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Your diary stays on this device and syncs privately to your account.
      </p>
    </motion.div>
  );
}
