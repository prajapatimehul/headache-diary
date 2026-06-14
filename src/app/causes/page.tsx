"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  Copy,
  Check,
  HeartPulse,
  Pill,
  Search,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";
import { db } from "@/lib/db";
import { loadProfile, runCauseFinder } from "@/lib/cause-finder";
import type { CauseCandidate, Urgency } from "@/lib/cause-finder";

const URGENCY_STYLE: Record<Urgency, { dot: string; label: string }> = {
  emergency: { dot: "bg-destructive", label: "Emergency" },
  urgent: { dot: "bg-[--h6]", label: "See a doctor soon" },
  routine: { dot: "bg-primary", label: "Worth discussing" },
};

function CopyLine({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard?.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable / permission denied — don't claim success */
        }
      }}
      className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary"
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function CandidateCard({ c }: { c: CauseCandidate }) {
  const u = URGENCY_STYLE[c.urgency];
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg leading-tight">{c.name}</h3>
          <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`size-2 rounded-full ${u.dot}`} />
            {u.label}
            {c.code && <span className="ml-1 opacity-70">· ICHD-3 {c.code}</span>}
          </span>
        </div>
      </div>

      {c.matched.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Why this fits you
          </p>
          <ul className="mt-1 space-y-1 text-sm">
            {c.matched.map((m, i) => (
              <li key={i} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {c.against.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Argues against: {c.against.join("; ")}
        </p>
      )}

      <div className="mt-4 space-y-3 rounded-xl bg-secondary/50 p-3 text-sm">
        <div className="flex gap-2">
          <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <span className="font-medium">Test that settles it: </span>
            {c.confirmingTest}
          </div>
        </div>
        <div className="flex gap-2">
          <Stethoscope className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <span className="font-medium">Who to see: </span>
            {c.specialist}
          </div>
        </div>
        <div className="flex gap-2">
          <HeartPulse className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <span className="font-medium">What to say: </span>
            <span className="italic">“{c.whatToSay}”</span>
            <CopyLine text={c.whatToSay} />
          </div>
        </div>
      </div>

      {c.note && (
        <p className="mt-2 text-xs italic text-muted-foreground">{c.note}</p>
      )}
    </div>
  );
}

export default function CausesPage() {
  const reduce = useReducedMotion();
  const live = useLiveQuery(() => db.entries.toArray(), []);
  const profile = useMemo(() => loadProfile(), []);
  const report = useMemo(
    () => runCauseFinder(live ?? [], profile),
    [live, profile],
  );

  const ease = [0.22, 1, 0.36, 1] as const;
  const enter = reduce
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease } };

  const profileBlank = profile.positional === "unknown" &&
    profile.treatmentsTried.length === 0 &&
    !profile.jawClickOrPainChewing &&
    !profile.pulsatileTinnitus;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-28 pt-6">
      <motion.header {...enter}>
        <h1 className="font-display text-3xl">Cause Finder</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What could be driving this — and the exact next step. Pairs with the
          ICHD-3 read in Insight.
        </p>
      </motion.header>

      {/* EMERGENCIES — loud, first */}
      {report.emergencies.length > 0 && (
        <motion.section
          {...enter}
          className="mt-5 rounded-2xl border-2 border-destructive bg-destructive/10 p-5"
        >
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            <h2 className="font-display text-lg">Get urgent care</h2>
          </div>
          <ul className="mt-3 space-y-3">
            {report.emergencies.map((f) => (
              <li key={f.id}>
                <p className="font-medium">{f.label}</p>
                <p className="text-sm text-muted-foreground">{f.detail}</p>
                <p className="mt-1 text-sm font-medium">{f.action}</p>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {/* Improve-accuracy CTA */}
      {profileBlank && (
        <motion.div {...enter} className="mt-5">
          <Link
            href="/assess"
            className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4"
          >
            <Search className="size-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium">Sharpen this in 2 minutes</p>
              <p className="text-xs text-muted-foreground">
                A few questions a rushed visit skips (positional, jaw, prior
                tests) make the cause search far more accurate.
              </p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
        </motion.div>
      )}

      {/* Red flags (non-emergency) */}
      {report.redFlags.length > 0 && (
        <motion.section {...enter} className="mt-5">
          <h2 className="font-display text-xl">Worth flagging to a doctor</h2>
          <div className="mt-3 space-y-3">
            {report.redFlags.map((f) => (
              <div
                key={f.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-center gap-2">
                  <TriangleAlert className="size-4 text-[--h6]" />
                  <p className="font-medium">{f.label}</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{f.detail}</p>
                <p className="mt-1 text-sm">{f.action}</p>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Two-layer */}
      {report.twoLayer && (
        <motion.section
          {...enter}
          className="mt-5 rounded-2xl border border-border bg-card p-4"
        >
          <p className="text-sm">{report.twoLayer}</p>
        </motion.section>
      )}

      {/* Candidates */}
      <motion.section {...enter} className="mt-6">
        <h2 className="font-display text-xl">Causes to explore</h2>
        {report.candidates.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Not enough signal yet to point at a specific cause. Keep logging, and
            answer the{" "}
            <Link href="/assess" className="text-primary underline">
              cause questions
            </Link>{" "}
            to sharpen it.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {report.candidates.map((c) => (
              <CandidateCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </motion.section>

      {/* MOH */}
      {report.moh.atRisk && (
        <motion.section
          {...enter}
          className="mt-5 rounded-2xl border border-[--h6]/40 bg-[--h6]/10 p-4"
        >
          <div className="flex items-center gap-2">
            <Pill className="size-4 text-[--h6]" />
            <p className="font-medium">Medication-overuse risk</p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {report.moh.message}
          </p>
        </motion.section>
      )}

      {/* Treatment mismatch */}
      {report.mismatch.present && (
        <motion.section
          {...enter}
          className="mt-5 rounded-2xl border border-border bg-card p-4"
        >
          <p className="font-medium">Is the right layer being treated?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {report.mismatch.message}
          </p>
        </motion.section>
      )}

      {/* Workup gaps */}
      {report.workupGaps.length > 0 && (
        <motion.section {...enter} className="mt-5">
          <h2 className="font-display text-xl">Tests worth asking about</h2>
          <div className="mt-3 space-y-2">
            {report.workupGaps.map((g, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-3"
              >
                <p className="text-sm font-medium">{g.test}</p>
                <p className="text-xs text-muted-foreground">{g.reason}</p>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Phase-2 links */}
      <motion.section {...enter} className="mt-6 grid grid-cols-1 gap-2">
        <Link
          href="/assess"
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm active:bg-secondary/60"
        >
          <Search className="size-4 text-muted-foreground" />
          <span className="flex-1 font-medium">Answer the cause questions</span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
        <Link
          href="/advocate"
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm active:bg-secondary/60"
        >
          <HeartPulse className="size-4 text-muted-foreground" />
          <span className="flex-1 font-medium">How to get taken seriously</span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
        <Link
          href="/learn"
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm active:bg-secondary/60"
        >
          <Stethoscope className="size-4 text-muted-foreground" />
          <span className="flex-1 font-medium">Learn: types &amp; myths</span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
      </motion.section>

      <p className="mt-6 px-1 text-center text-xs leading-relaxed text-muted-foreground">
        {report.disclaimer}
      </p>
    </main>
  );
}
