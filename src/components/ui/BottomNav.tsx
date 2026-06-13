"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Activity, Sparkles, FileDown, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  icon: typeof Activity;
  /** active also when pathname starts with one of these */
  match: (p: string) => boolean;
}

const TABS: Tab[] = [
  { href: "/", label: "Today", icon: Activity, match: (p) => p === "/" || p.startsWith("/history") },
  { href: "/insight", label: "Insight", icon: Sparkles, match: (p) => p.startsWith("/insight") },
  { href: "/report", label: "Export", icon: FileDown, match: (p) => p.startsWith("/report") },
  { href: "/you", label: "You", icon: User, match: (p) => p.startsWith("/you") },
];

export function BottomNav() {
  const pathname = usePathname() || "/";

  // Never render over the print route.
  if (pathname.startsWith("/report/print")) return null;

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 print:hidden",
        "border-t border-border/70 bg-background/80 backdrop-blur-xl",
        "pb-safe",
      )}
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="contents">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[56px] flex-col items-center justify-center gap-1 px-2 pt-2",
                  "text-[11px] font-medium tracking-wide transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="bottomnav-active"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary"
                  />
                )}
                <Icon
                  aria-hidden
                  className={cn("size-5 transition-transform", active && "scale-110")}
                  strokeWidth={active ? 2.4 : 1.9}
                />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
