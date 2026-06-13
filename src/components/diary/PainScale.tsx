"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const HEAT_VARS = [
  "--h0", "--h1", "--h2", "--h3", "--h4", "--h5",
  "--h6", "--h7", "--h8", "--h9", "--h10",
] as const;

/** CSS color string for a 0-10 intensity, using the design-system heat vars. */
export function heatVar(value: number): string {
  const i = Math.max(0, Math.min(10, Math.round(value)));
  return `var(${HEAT_VARS[i]})`;
}

const BAND = (v: number) =>
  v === 0 ? "No pain" : v <= 3 ? "Mild" : v <= 6 ? "Moderate" : "Severe";

export function PainScale({
  value,
  onChange,
  label = "Pain intensity",
  disabled = false,
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const color = heatVar(value);
  const pct = (value / 10) * 100;

  return (
    <div className={cn("select-none", disabled && "pointer-events-none opacity-40")}>
      <div className="mb-3 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
        <div className="flex items-baseline gap-2">
          <motion.span
            key={value}
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            className="font-display text-3xl leading-none tabular-nums"
            style={{ color }}
          >
            {value}
          </motion.span>
          <span className="text-xs text-muted-foreground">/ 10</span>
        </div>
      </div>

      <div className="relative h-11">
        {/* gradient track */}
        <div
          className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, var(--h0), var(--h2), var(--h4), var(--h6), var(--h8), var(--h10))",
            opacity: 0.35,
          }}
        />
        {/* active fill */}
        <div
          className="absolute left-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full transition-[width] duration-200 ease-out"
          style={{ width: `calc(${pct}% )`, background: color }}
        />
        {/* thumb halo */}
        <div
          className="pointer-events-none absolute top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow-lg transition-[left] duration-200 ease-out"
          style={{ left: `${pct}%`, background: color }}
        />
        <input
          id={id}
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          disabled={disabled}
          aria-valuetext={`${value} of 10, ${BAND(value)}`}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "absolute inset-0 h-11 w-full cursor-pointer appearance-none bg-transparent",
            "focus-visible:outline-none",
            // hide native thumb/track — we render our own visuals above
            "[&::-webkit-slider-thumb]:h-11 [&::-webkit-slider-thumb]:w-11 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:opacity-0",
            "[&::-moz-range-thumb]:h-11 [&::-moz-range-thumb]:w-11 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:opacity-0",
          )}
        />
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>0</span>
        <span className="font-medium" style={{ color }}>
          {BAND(value)}
        </span>
        <span>10</span>
      </div>
    </div>
  );
}
