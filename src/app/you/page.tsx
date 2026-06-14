"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Activity,
  CalendarDays,
  Check,
  Cloud,
  CloudOff,
  Download,
  History,
  KeyRound,
  Loader2,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
} from "lucide-react";
import { db } from "@/lib/db";
import { pullAndMerge, pushDirty } from "@/lib/db/sync";
import { createClient } from "@/lib/supabase/client";

// Theme is external (DOM) state — read it via useSyncExternalStore so there's no
// setState-in-effect and SSR is handled by the server snapshot. The pre-paint
// script in layout.tsx applies the saved theme before hydration.
const THEME_EVENT = "hd-theme-change";
function subscribeTheme(cb: () => void) {
  window.addEventListener(THEME_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(THEME_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function themeSnapshot(): "dark" | "light" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export default function YouPage() {
  const reduce = useReducedMotion();
  const entries = useLiveQuery(() => db.entries.toArray(), []) ?? [];
  const totalDays = entries.length;
  const headacheDays = entries.filter((e) => !e.no_headache).length;

  const [email, setEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Set/change password — lets magic-link users adopt email+password login.
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwOk, setPwOk] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);

  const theme = useSyncExternalStore(
    subscribeTheme,
    themeSnapshot,
    () => "dark" as const, // server snapshot: dark is the default
  );

  // auth state
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  async function signOut() {
    // Flush anything unsynced first, then clear the local DB — otherwise the
    // next person to use this device/browser would see this account's entries
    // (Dexie is local and not RLS-gated). Synced data is safe in the cloud and
    // returns on next sign-in via pullAndMerge.
    try {
      await pushDirty();
    } catch (e) {
      console.error("[sync] flush before sign-out failed", e);
    }
    await createClient().auth.signOut();
    await db.entries.clear();
    setEmail(null);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwBusy(true);
    setPwErr(null);
    setPwOk(false);
    const { error } = await createClient().auth.updateUser({ password: newPw });
    if (error) {
      setPwErr(
        /at least|should be/i.test(error.message)
          ? "Password must be at least 6 characters."
          : error.message,
      );
    } else {
      setPwOk(true);
      setNewPw("");
      setPwOpen(false);
    }
    setPwBusy(false);
  }

  async function syncNow() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      await pullAndMerge();
      await pushDirty();
      setSyncMsg("Synced just now");
    } catch {
      setSyncMsg("Sync failed — check connection");
    } finally {
      setSyncing(false);
    }
  }

  const ease = [0.22, 1, 0.36, 1] as const;
  const enter = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, ease },
      };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-28 pt-6">
      <motion.header {...enter}>
        <h1 className="font-display text-3xl">You</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Account, sync &amp; settings.
        </p>
      </motion.header>

      {/* Account / sync */}
      <motion.section
        {...enter}
        transition={reduce ? undefined : { duration: 0.4, ease, delay: 0.04 }}
        className="mt-6 rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-secondary text-primary">
            {email ? <Cloud className="size-5" /> : <CloudOff className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            {authReady && email ? (
              <>
                <p className="truncate font-medium">{email}</p>
                <p className="text-xs text-muted-foreground">
                  Signed in · syncing across devices
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">Not signed in</p>
                <p className="text-xs text-muted-foreground">
                  Entries are saved on this device only
                </p>
              </>
            )}
          </div>
        </div>

        {authReady && email ? (
          <div className="mt-4 flex gap-2">
            <button
              onClick={syncNow}
              disabled={syncing}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground active:scale-[0.99] disabled:opacity-60"
            >
              <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync now"}
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground active:scale-[0.99]"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        ) : null}

        {/* Set / change password — so magic-link users can log in without email */}
        {authReady && email && (
          <div className="mt-3 border-t border-border pt-3">
            {!pwOpen ? (
              <button
                onClick={() => {
                  setPwOpen(true);
                  setPwOk(false);
                  setPwErr(null);
                }}
                className="flex w-full items-center gap-2 text-left text-sm font-medium text-muted-foreground active:scale-[0.99]"
              >
                <KeyRound className="size-4" />
                <span className="flex-1">
                  {pwOk ? "Password set" : "Set a password"}
                </span>
                {pwOk ? (
                  <Check className="size-4 text-primary" />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    log in without email
                  </span>
                )}
              </button>
            ) : (
              <form onSubmit={savePassword} className="space-y-2">
                <label htmlFor="newpw" className="text-xs text-muted-foreground">
                  Choose a password (6+ characters). Then you can log in with your
                  email + password — no link needed.
                </label>
                <div className="flex gap-2">
                  <input
                    id="newpw"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="New password"
                    disabled={pwBusy}
                    className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={pwBusy}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {pwBusy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </button>
                </div>
                {pwErr && <p className="text-xs text-destructive">{pwErr}</p>}
              </form>
            )}
            {pwOk && (
              <p className="mt-2 text-xs text-primary">
                Saved. Next time you can log in with email + password.
              </p>
            )}
          </div>
        )}

        {!(authReady && email) && (
          <Link
            href="/login"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground active:scale-[0.99]"
          >
            <Cloud className="size-4" />
            Sign in to sync
          </Link>
        )}
        {syncMsg && (
          <p className="mt-2 text-center text-xs text-muted-foreground">{syncMsg}</p>
        )}
      </motion.section>

      {/* Stats */}
      <motion.section
        {...enter}
        transition={reduce ? undefined : { duration: 0.4, ease, delay: 0.08 }}
        className="mt-4 grid grid-cols-2 gap-3"
      >
        <div className="rounded-2xl border border-border bg-card p-4">
          <CalendarDays className="size-5 text-primary" />
          <p className="mt-2 font-display text-2xl">{totalDays}</p>
          <p className="text-xs text-muted-foreground">Days logged</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <Activity className="size-5 text-primary" />
          <p className="mt-2 font-display text-2xl">{headacheDays}</p>
          <p className="text-xs text-muted-foreground">Headache days</p>
        </div>
      </motion.section>

      {/* Links */}
      <motion.section
        {...enter}
        transition={reduce ? undefined : { duration: 0.4, ease, delay: 0.12 }}
        className="mt-4 overflow-hidden rounded-2xl border border-border bg-card"
      >
        <Link
          href="/history"
          className="flex items-center gap-3 px-5 py-4 active:bg-secondary/60"
        >
          <History className="size-5 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium">History</span>
          <span className="text-muted-foreground">›</span>
        </Link>
        <div className="h-px bg-border" />
        <Link
          href="/report"
          className="flex items-center gap-3 px-5 py-4 active:bg-secondary/60"
        >
          <Download className="size-5 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium">Export for doctor</span>
          <span className="text-muted-foreground">›</span>
        </Link>
        <div className="h-px bg-border" />
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 px-5 py-4 text-left active:bg-secondary/60"
        >
          {theme === "dark" ? (
            <Moon className="size-5 text-muted-foreground" />
          ) : (
            <Sun className="size-5 text-muted-foreground" />
          )}
          <span className="flex-1 text-sm font-medium">
            Theme: {theme === "dark" ? "Dark" : "Light"}
          </span>
          <span className="text-xs text-muted-foreground">tap to switch</span>
        </button>
      </motion.section>

      <p className="mt-6 px-1 text-center text-xs leading-relaxed text-muted-foreground">
        Headache Diary is decision support, not a diagnosis. Your notes are
        private and never used to change an ICHD-3 verdict. For emergencies
        (sudden worst-ever headache, fever with stiff neck, weakness, vision
        loss) seek urgent care.
      </p>
    </main>
  );
}
