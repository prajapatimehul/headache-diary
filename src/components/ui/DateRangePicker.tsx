"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export interface DateRange {
  /** YYYY-MM-DD inclusive */
  from: string;
  /** YYYY-MM-DD inclusive */
  to: string;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const PRESETS: { label: string; days: number }[] = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export function DateRangePicker({
  value,
  onChange,
  className,
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  className?: string;
}) {
  const fromId = useId();
  const toId = useId();

  function applyPreset(days: number) {
    onChange({ from: isoDaysAgo(days - 1), to: todayIso() });
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-2">
        {PRESETS.map((p) => {
          const active =
            value.from === isoDaysAgo(p.days - 1) && value.to === todayIso();
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.days)}
              aria-pressed={active}
              className={cn(
                "min-h-[44px] flex-1 rounded-xl border text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground",
              )}
            >
              Last {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label htmlFor={fromId} className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            From
          </span>
          <input
            id={fromId}
            type="date"
            value={value.from}
            max={value.to}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="h-11 w-full rounded-xl border border-border bg-secondary/60 px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label htmlFor={toId} className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            To
          </span>
          <input
            id={toId}
            type="date"
            value={value.to}
            min={value.from}
            max={todayIso()}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="h-11 w-full rounded-xl border border-border bg-secondary/60 px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>
    </div>
  );
}

export { isoDaysAgo, todayIso };
