"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { Option } from "@/types/entry";

/**
 * Reusable multi-select chip group bound to a `string[]`. Large touch targets
 * (≥44px), calm motion, AA-contrast selected state. Generic over the option
 * value type so callers stay type-safe.
 */
export function SymptomChips<V extends string>({
  options,
  value,
  onChange,
  label,
  className,
  "aria-label": ariaLabel,
}: {
  options: Option<V>[];
  value: V[];
  onChange: (next: V[]) => void;
  label?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const selected = new Set(value);

  function toggle(v: V) {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    // preserve the option order in the output
    onChange(options.filter((o) => next.has(o.value)).map((o) => o.value));
  }

  return (
    <div className={className}>
      {label && (
        <p className="mb-2 text-sm font-medium text-muted-foreground">{label}</p>
      )}
      <div
        role="group"
        aria-label={ariaLabel ?? label}
        className="flex flex-wrap gap-2"
      >
        {options.map((o) => {
          const on = selected.has(o.value);
          return (
            <motion.button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.value)}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={cn(
                "flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 py-2 text-sm",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {on && <Check aria-hidden className="size-3.5 text-primary" strokeWidth={3} />}
              <span className="flex flex-col items-start leading-tight">
                <span className="font-medium">{o.label}</span>
                {o.hint && (
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {o.hint}
                  </span>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Single-select variant (segmented control look) bound to one value. Used for
 * quality / laterality / nausea / onset where exactly one applies.
 */
export function SymptomSegments<V extends string>({
  options,
  value,
  onChange,
  label,
  className,
  allowDeselect = false,
}: {
  options: Option<V>[];
  value: V | undefined;
  onChange: (next: V | undefined) => void;
  label?: string;
  className?: string;
  allowDeselect?: boolean;
}) {
  return (
    <div className={className}>
      {label && (
        <p className="mb-2 text-sm font-medium text-muted-foreground">{label}</p>
      )}
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <motion.button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              onClick={() => onChange(allowDeselect && on ? undefined : o.value)}
              className={cn(
                "flex min-h-[44px] flex-col items-start justify-center rounded-2xl border px-4 py-2 text-sm",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="font-medium leading-tight">{o.label}</span>
              {o.hint && (
                <span className="text-[10px] font-normal text-muted-foreground">
                  {o.hint}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
