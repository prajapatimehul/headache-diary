"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type PainMark } from "@/lib/db";
import { saveEntry, pullAndMerge, pushDirty } from "@/lib/db/sync";
import { PainScale } from "@/components/diary/PainScale";
import { EntryForm } from "@/components/diary/EntryForm";
import { InstallHint } from "@/components/ui/InstallHint";

// three.js MUST NOT SSR.
const HeadScene = dynamic(() => import("@/components/head/HeadScene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[52dvh] place-items-center text-sm text-muted-foreground">
      <span className="animate-pulse">Preparing the head…</span>
    </div>
  ),
});

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

export default function Home() {
  const [intensity, setIntensity] = useState(5);
  const [marks, setMarks] = useState<PainMark[]>([]);

  // total logged days drives the "Day N" chip
  const entryCount = useLiveQuery(() => db.entries.count(), [], 0);

  useEffect(() => {
    // Best-effort background sync — surface failures to the console only here;
    // the "Sync now" button on /you reports them to the user.
    void pullAndMerge().catch((e) =>
      console.error("[sync] initial pull failed", e),
    );
    const onOnline = () =>
      void pushDirty().catch((e) =>
        console.error("[sync] reconnect push failed", e),
      );
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const dayN = (entryCount ?? 0) + 1;

  return (
    <motion.main
      variants={stagger}
      initial="hidden"
      animate="show"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-28 pt-safe"
    >
      <motion.header
        variants={fadeUp}
        className="flex items-baseline justify-between pt-4"
      >
        <div>
          <h1 className="font-display text-3xl leading-none">Today</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the head where it hurts.
          </p>
        </div>
        <span className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground">
          Day {dayN}
        </span>
      </motion.header>

      <motion.section
        variants={fadeUp}
        className="mt-4 h-[52dvh] w-full touch-none overflow-hidden rounded-3xl border border-border/60 bg-card/30"
      >
        <HeadScene
          intensity={intensity}
          marks={marks}
          onPlace={(m) => setMarks((p) => [...p, m])}
        />
      </motion.section>

      {marks.length > 0 && (
        <motion.div
          variants={fadeUp}
          className="mt-2 flex items-center justify-between text-xs text-muted-foreground"
        >
          <span>
            {marks.length} {marks.length === 1 ? "spot" : "spots"} marked
          </span>
          <button
            type="button"
            onClick={() => setMarks([])}
            className="rounded-full px-2 py-1 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear
          </button>
        </motion.div>
      )}

      <motion.section variants={fadeUp} className="mt-5">
        <PainScale value={intensity} onChange={setIntensity} />
      </motion.section>

      <motion.section variants={fadeUp} className="mt-6">
        <EntryForm
          marks={marks}
          intensity={intensity}
          onSave={async (entry) => {
            await saveEntry(entry);
            setMarks([]);
          }}
        />
      </motion.section>

      <InstallHint />
    </motion.main>
  );
}
