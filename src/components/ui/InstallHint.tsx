"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Share, Plus, X } from "lucide-react";

const DISMISS_KEY = "hd-install-hint-dismissed";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac; detect by touch points
  const iPadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari legacy flag
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * iOS "Add to Home Screen" hint. iOS Safari has no `beforeinstallprompt`, so we
 * surface a manual instruction. Hidden once installed (standalone) or dismissed.
 */
export function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIos() || isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* private mode — show anyway */
    }
    const t = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.aside
          role="dialog"
          aria-label="Install Headache Diary"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-[60] mx-auto max-w-md rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-xl print:hidden"
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
          <p className="font-display text-base">Add to Home Screen</p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            Tap
            <Share aria-label="Share" className="inline size-4 text-primary" />
            then
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Plus className="size-4" /> Add to Home Screen
            </span>
            to use it full-screen, offline.
          </p>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
