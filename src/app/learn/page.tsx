"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { CrisisSupport } from "@/components/ui/CrisisSupport";

const TYPES: { name: string; feels: string; tell: string }[] = [
  {
    name: "Migraine",
    feels: "Throbbing, often one-sided, moderate–severe, worse with activity, lasting 4–72h, usually with nausea and/or light + sound sensitivity.",
    tell: "Only ~30% have visual aura — most migraine has none. It's a brain disorder; triggers exacerbate it, they don't 'cause' it.",
  },
  {
    name: "Tension-type",
    feels: "Pressing/tightening 'band', usually both sides, mild–moderate, NOT worse with activity, no nausea.",
    tell: "The most common headache. Often co-exists with migraine and feeds it — both layers may need treating.",
  },
  {
    name: "Cervicogenic (neck-driven)",
    feels: "One side, starts at the back of the head/neck, provoked by neck movement or posture; often worse on waking, eases with movement.",
    tell: "Confirmed by a diagnostic nerve block — NOT by an MRI (degeneration on MRI is common and doesn't prove it). The most missed cause.",
  },
  {
    name: "Cluster / autonomic",
    feels: "Severe, strictly one-sided around the eye, with a red/watering eye, blocked nostril or droopy lid, and restlessness; comes in bouts, often at the same time of day.",
    tell: "Distinct from migraine — needs specific treatment. Restlessness (pacing) is a clue vs migraine (lie still).",
  },
  {
    name: "New daily persistent (NDPH)",
    feels: "A daily headache that you can trace to a specific day it started and never went away.",
    tell: "A different diagnosis — standard migraine drugs often don't work. The clear 'day one' onset is the key clue.",
  },
  {
    name: "Sinus / rhinogenic",
    feels: "Facial pressure, blocked nose, post-nasal drip, often after a cold.",
    tell: "Real, but over-diagnosed — many 'sinus headaches' are migraine. Confirmed by endoscopy/CT, not by guesswork.",
  },
  {
    name: "Medication-overuse",
    feels: "A daily/near-daily headache in someone taking acute painkillers very often.",
    tell: "Painkillers on ≥10–15 days/month for >3 months can themselves cause a rebound headache. Fixable, with a doctor-guided step-down.",
  },
];

const MYTHS: { myth: string; truth: string }[] = [
  { myth: "“Migraine always has aura / nausea.”", truth: "False — most migraine has no aura, and presentation varies. Believing this makes people dismiss their own migraine for years." },
  { myth: "“A daily headache is just stress / normal.”", truth: "A daily headache is never normal. It deserves a proper work-up, not just more painkillers." },
  { myth: "“Triggers cause my migraine.”", truth: "Triggers exacerbate an underlying disorder; they don't create it. That's why trigger-hunting alone often finds '0 correlation'." },
  { myth: "“It's just a sinus headache.”", truth: "Often it's migraine — but real sinus disease also exists. Both directions get missed; imaging settles it." },
  { myth: "“If scans are clear, nothing's wrong.”", truth: "Most primary headaches have normal scans. Diagnosis is made by the pattern against criteria, not only by imaging." },
];

export default function LearnPage() {
  const reduce = useReducedMotion();
  const enter = reduce
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-28 pt-6">
      <motion.header {...enter}>
        <h1 className="font-display text-3xl">Learn</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          “Headache” isn&rsquo;t one thing. The official classification (ICHD-3)
          recognises 14 major groups and 300+ types — knowing yours is how you
          get the right treatment.
        </p>
      </motion.header>

      <motion.section {...enter} className="mt-6">
        <h2 className="font-display text-xl">The common types</h2>
        <div className="mt-3 space-y-3">
          {TYPES.map((t) => (
            <div key={t.name} className="rounded-2xl border border-border bg-card p-4">
              <h3 className="font-display text-lg">{t.name}</h3>
              <p className="mt-1 text-sm">{t.feels}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t.tell}</p>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section {...enter} className="mt-7">
        <h2 className="font-display text-xl">Myths that cost people years</h2>
        <div className="mt-3 space-y-3">
          {MYTHS.map((m) => (
            <div key={m.myth} className="rounded-2xl border border-border bg-card p-4">
              <p className="font-medium">{m.myth}</p>
              <p className="mt-1 text-sm text-muted-foreground">{m.truth}</p>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section {...enter} className="mt-7 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm">
          The full classification is public at{" "}
          <a
            href="https://ichd-3.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            ichd-3.org
          </a>
          . Your{" "}
          <Link href="/insight" className="text-primary underline">
            Insight
          </Link>{" "}
          read and{" "}
          <Link href="/causes" className="text-primary underline">
            Cause Finder
          </Link>{" "}
          map your logged pattern onto it.
        </p>
      </motion.section>

      <div className="mt-7">
        <CrisisSupport />
      </div>

      <p className="mt-6 px-1 text-center text-xs leading-relaxed text-muted-foreground">
        Educational summary, not medical advice. Always confirm with a clinician.
      </p>
    </main>
  );
}
