"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Sparkles,
  CircleCheck,
  CircleDashed,
  CircleX,
  FlaskConical,
  Info,
  ChevronRight,
} from "lucide-react";
import { db } from "@/lib/db";
import { progressiveInsight } from "@/lib/ichd3/engine";
import type { DxResult, Verdict, CriterionResult } from "@/lib/ichd3/model";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------- verdict --- */

const VERDICT_META: Record<
  Verdict,
  { label: string; icon: typeof CircleCheck; cls: string; dot: string }
> = {
  MET: {
    label: "Criteria met",
    icon: CircleCheck,
    cls: "text-[var(--h2)] border-[var(--h2)]/40 bg-[var(--h2)]/10",
    dot: "var(--h2)",
  },
  PROBABLE: {
    label: "Probable",
    icon: CircleDashed,
    cls: "text-[var(--h4)] border-[var(--h4)]/40 bg-[var(--h4)]/10",
    dot: "var(--h4)",
  },
  NEEDS_TEST: {
    label: "Needs a clinical test",
    icon: FlaskConical,
    cls: "text-primary border-primary/40 bg-primary/10",
    dot: "var(--primary)",
  },
  NOT_MET: {
    label: "Not met",
    icon: CircleX,
    cls: "text-muted-foreground border-border bg-secondary/50",
    dot: "var(--muted-foreground)",
  },
};

function VerdictChip({ verdict }: { verdict: Verdict }) {
  const m = VERDICT_META[verdict];
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        m.cls,
      )}
    >
      <Icon aria-hidden className="size-3.5" /> {m.label}
    </span>
  );
}

/* ------------------------------------------------------------- confidence -- */

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground">Confidence</span>
        <span className="font-display text-lg tabular-nums">{pct}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full bg-primary"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- criterion --- */

function CriterionRow({ crit }: { crit: CriterionResult }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {crit.passed ? (
        <CircleCheck
          aria-label="passed"
          className="mt-0.5 size-4 shrink-0 text-[var(--h2)]"
        />
      ) : (
        <CircleX
          aria-label="not met"
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
      )}
      <span className={cn(crit.passed ? "text-foreground" : "text-muted-foreground")}>
        <span className="font-medium">{crit.id}.</span> {crit.text}
        {crit.reason && (
          <span className="block text-xs text-muted-foreground">{crit.reason}</span>
        )}
      </span>
    </li>
  );
}

/* --------------------------------------------------------------- candidate -- */

function CandidateCard({ dx, index }: { dx: DxResult; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-2xl border border-border bg-card/60"
    >
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tabular-nums text-muted-foreground">
            ICHD-3 {dx.code}
          </p>
          <h3 className="font-display text-lg leading-tight">{dx.name}</h3>
        </div>
        <VerdictChip verdict={dx.verdict} />
      </div>

      {dx.needsTest && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
          <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{dx.needsTest}</span>
        </div>
      )}

      <details className="group border-t border-border/60">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Criteria
          <ChevronRight
            aria-hidden
            className="size-4 transition-transform group-open:rotate-90"
          />
        </summary>
        <ul className="space-y-2 px-4 pb-4">
          {dx.criteria.map((cr) => (
            <CriterionRow key={cr.id} crit={cr} />
          ))}
        </ul>
      </details>
    </motion.article>
  );
}

/* ----------------------------------------------------------------- stages -- */

const STAGE_COPY: Record<
  "warmup" | "preliminary" | "strong",
  { title: string; tag: string; blurb: string }
> = {
  warmup: {
    title: "Warming up",
    tag: "Day 1–4",
    blurb:
      "A few more days of logging and a first read appears. Keep going — even pain-free days count.",
  },
  preliminary: {
    title: "Preliminary read",
    tag: "Day 5–29",
    blurb:
      "Early pattern from your entries. It can still shift as more days are logged.",
  },
  strong: {
    title: "Strong read",
    tag: "Day 30+",
    blurb: "Enough data for a full criteria check across your typical attacks.",
  },
};

const DISCLAIMER = "Decision support, not a diagnosis. Confirm with a clinician.";
const EDUCATION = "ICHD-3 recognizes 14 major groups & 300+ types of headache.";

export default function InsightPage() {
  const entries = useLiveQuery(() => db.entries.toArray(), []);

  const insight = useMemo(() => {
    if (!entries) return null;
    try {
      return progressiveInsight(entries);
    } catch {
      return null;
    }
  }, [entries]);

  if (entries === undefined || insight === null) {
    return (
      <main className="mx-auto w-full max-w-md px-4 pb-28 pt-safe">
        <header className="pt-4">
          <h1 className="font-display text-3xl leading-none">Insight</h1>
        </header>
        <div className="mt-6 space-y-2" aria-hidden>
          <div className="h-40 animate-pulse rounded-3xl bg-card/50" />
          <div className="h-28 animate-pulse rounded-2xl bg-card/50" />
        </div>
      </main>
    );
  }

  const stage = STAGE_COPY[insight.stage];
  const total = entries.length;
  const target = insight.stage === "warmup" ? 5 : 30;
  const progressPct = Math.min(100, Math.round((insight.daysLogged / target) * 100));

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-28 pt-safe">
      <header className="pt-4">
        <h1 className="font-display text-3xl leading-none">Insight</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A read that builds as you log.
        </p>
      </header>

      {/* Stage hero */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="mt-5 rounded-3xl border border-border bg-card/60 p-5"
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles aria-hidden className="size-3.5" /> {stage.tag}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {insight.daysLogged} {insight.daysLogged === 1 ? "day" : "days"} logged
          </span>
        </div>

        <h2 className="mt-3 font-display text-2xl leading-tight">{stage.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{stage.blurb}</p>

        {insight.stage === "warmup" ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                To a first read
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {insight.daysLogged} / {target}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full bg-primary"
              />
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <ConfidenceMeter value={insight.confidence} />
          </div>
        )}
      </motion.section>

      {/* Top candidates */}
      {insight.topCandidates.length > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="font-display text-lg">
            {insight.stage === "strong" ? "What the criteria show" : "Leading candidates"}
          </h2>
          {insight.topCandidates.map((dx, i) => (
            <CandidateCard key={dx.code} dx={dx} index={i} />
          ))}
        </section>
      )}

      {/* What's needed */}
      {insight.needed.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-card/40 p-4">
          <h2 className="font-display text-base">What would sharpen this</h2>
          <ul className="mt-2 space-y-2">
            {insight.needed.map((n, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CircleDashed aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Caveats */}
      {insight.caveats.length > 0 && (
        <section className="mt-4 rounded-2xl border border-[var(--h4)]/30 bg-[var(--h4)]/5 p-4">
          <h2 className="flex items-center gap-1.5 font-display text-base">
            <Info aria-hidden className="size-4 text-[var(--h4)]" /> Worth knowing
          </h2>
          <ul className="mt-2 space-y-2">
            {insight.caveats.map((c, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Education line */}
      <p className="mt-6 text-center text-xs text-muted-foreground">{EDUCATION}</p>

      {/* Decision-support disclaimer — always present near any verdict */}
      <p className="mt-2 rounded-xl border border-border bg-secondary/40 p-3 text-center text-xs text-muted-foreground">
        {DISCLAIMER}
      </p>

      {total > 0 && (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Based on {total} {total === 1 ? "entry" : "entries"}. The read only uses
          structured fields — never your free-text notes.
        </p>
      )}
    </main>
  );
}
