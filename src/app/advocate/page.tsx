"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Check, Copy, FileDown } from "lucide-react";
import { CrisisSupport } from "@/components/ui/CrisisSupport";

const SCRIPTS: { title: string; text: string }[] = [
  {
    title: "Ask for a referral",
    text: "I've had this headache for a long time and it's affecting my life. I'd like a referral to a neurologist / headache specialist (and ENT or ophthalmology if relevant). Can we arrange that?",
  },
  {
    title: "If they refuse to refer or investigate",
    text: "I understand. Please document in my notes that I asked for a referral / investigation and it was declined, and the reason. I'd like that on record.",
  },
  {
    title: "If it's dismissed as 'just stress' or 'just migraine'",
    text: "What specifically rules out a cervicogenic or secondary cause? Could we go through the ICHD-3 criteria with my diary before settling on a label?",
  },
  {
    title: "Request a specific test (use your Cause Finder)",
    text: "My pattern points to ___. The test that would confirm or rule it out is ___. Can we do that, or refer me to who can?",
  },
  {
    title: "Daily headache is never normal",
    text: "I have a headache most days. I know that isn't normal even if we can't name it yet — I'd like a plan to investigate it properly, not just more painkillers.",
  },
];

function ScriptCard({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm italic text-muted-foreground">“{text}”</p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard?.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable / permission denied — don't claim success */
          }
        }}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function AdvocatePage() {
  const reduce = useReducedMotion();
  const enter = reduce
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-28 pt-6">
      <motion.header {...enter}>
        <h1 className="font-display text-3xl">Getting taken seriously</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Many people lose years to being brushed off. These are the moves that
          actually move the system.
        </p>
      </motion.header>

      <motion.section {...enter} className="mt-5 space-y-3">
        <h2 className="font-display text-xl">Before the appointment</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" /><span>Bring your <strong>diary export (PDF)</strong> — 30 scored days beats a rushed recall and is harder to dismiss.</span></li>
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" /><span>Write your <strong>top 3 questions</strong> and what you most want from the visit (a referral? a specific test?).</span></li>
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" /><span>List what&rsquo;s <strong>already been tried and tested</strong> (so you&rsquo;re not sent in circles).</span></li>
        </ul>
        <Link href="/report" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
          <FileDown className="size-4" /> Get my doctor report
        </Link>
      </motion.section>

      <motion.section {...enter} className="mt-7">
        <h2 className="font-display text-xl">What to say</h2>
        <div className="mt-3 space-y-3">
          {SCRIPTS.map((s) => (
            <ScriptCard key={s.title} {...s} />
          ))}
        </div>
      </motion.section>

      <motion.section {...enter} className="mt-7 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-lg">If you&rsquo;re still stuck</h2>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          <li>Ask to be referred to a dedicated <strong>headache clinic</strong> — they exist and are different from a general neurologist.</li>
          <li>A <strong>second opinion</strong> is your right. Many people only got answers after switching doctors.</li>
          <li>Keep the diary going — a documented, worsening or changing pattern is itself a reason to investigate.</li>
        </ul>
      </motion.section>

      <div className="mt-7">
        <CrisisSupport />
      </div>

      <p className="mt-6 px-1 text-center text-xs leading-relaxed text-muted-foreground">
        This is general guidance to help you advocate for yourself — not medical
        or legal advice.
      </p>
    </main>
  );
}
