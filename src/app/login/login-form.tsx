"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Mail, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Status = "idle" | "sending" | "sent";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("sending");

    const supabase = createClient();
    // signInWithOtp sends a magic link by default. shouldCreateUser:true
    // makes this a combined passwordless sign-up + sign-in flow.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      setError(error.message);
      setStatus("idle");
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
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
            <span className="font-medium text-foreground">{email}</span>. Open it
            on this device to continue.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="h-11 w-full text-muted-foreground"
          onClick={() => {
            setStatus("idle");
            setError(null);
          }}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Use a different email
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.form
      onSubmit={signIn}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="text-sm font-medium text-foreground"
        >
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
            disabled={status === "sending"}
            aria-invalid={error ? true : undefined}
            className="h-12 w-full rounded-xl border border-border bg-card pr-3.5 pl-10 text-base text-foreground shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
          />
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
        disabled={status === "sending"}
        className="h-12 w-full text-base"
      >
        {status === "sending" ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Sending link…
          </>
        ) : (
          "Send magic link"
        )}
      </Button>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        No password needed. We&rsquo;ll email you a one-time sign-in link.
      </p>
    </motion.form>
  );
}
