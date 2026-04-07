"use client";

import { useMemo, useState } from "react";
import { MAX_AGE, MIN_AGE, numericAgeSpanFromString } from "@/lib/playing-age";

const PRESETS: { label: string; lo: number; hi: number }[] = [
  { label: "0–1", lo: 0, hi: 1 },
  { label: "2–12", lo: 2, hi: 12 },
  { label: "13–17", lo: 13, hi: 17 },
  { label: "18–25", lo: 18, hi: 25 },
  { label: "26–35", lo: 26, hi: 35 },
  { label: "36–45", lo: 36, hi: 45 },
  { label: "45–55", lo: 45, hi: 55 },
  { label: "56–65", lo: 56, hi: 65 },
  { label: "66–88", lo: 66, hi: 88 },
  { label: "89–100", lo: 89, hi: 100 },
];

export type AgeRangeSelectorProps = {
  /** `name` on the hidden input submitted with the form (default `age_range`). */
  name?: string;
  /** Initial `age_range` text from DB. */
  defaultRange?: string | null;
  defaultMin?: number | null;
  defaultMax?: number | null;
  labelClass: string;
  inputClass: string;
  /** Prefix for ids, e.g. `add` or `cast`. */
  idPrefix: string;
};

function deriveInitial(
  defaultRange?: string | null,
  defaultMin?: number | null,
  defaultMax?: number | null,
): { mode: "numeric" | "custom"; lo: string; hi: string; text: string } {
  const s = defaultRange?.trim();
  if (s) {
    const n = numericAgeSpanFromString(s);
    if (n) {
      return { mode: "numeric", lo: String(n.min), hi: String(n.max), text: "" };
    }
    return { mode: "custom", lo: "", hi: "", text: s };
  }
  if (defaultMin != null && defaultMax != null) {
    return {
      mode: "numeric",
      lo: String(defaultMin),
      hi: String(defaultMax),
      text: "",
    };
  }
  return { mode: "numeric", lo: "", hi: "", text: "" };
}

function numericHidden(lo: string, hi: string): string {
  const a = Number.parseInt(lo.trim(), 10);
  const b = Number.parseInt(hi.trim(), 10);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "";
  if (a < MIN_AGE || a > MAX_AGE || b < MIN_AGE || b > MAX_AGE) return "";
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  return `${low}-${high}`;
}

/**
 * Admin widget: low / high ages, quick presets, optional custom label. Submits one
 * `age_range` field (e.g. `45-55`) for the server action.
 */
export function AgeRangeSelector({
  name = "age_range",
  defaultRange,
  defaultMin,
  defaultMax,
  labelClass,
  inputClass,
  idPrefix,
}: AgeRangeSelectorProps) {
  const initial = useMemo(
    () => deriveInitial(defaultRange, defaultMin, defaultMax),
    [defaultRange, defaultMin, defaultMax],
  );

  const [mode, setMode] = useState<"numeric" | "custom">(initial.mode);
  const [lo, setLo] = useState(initial.lo);
  const [hi, setHi] = useState(initial.hi);
  const [text, setText] = useState(initial.text);

  const hiddenValue =
    mode === "custom" ? text.trim() : numericHidden(lo, hi);

  const presetBtn =
    "rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs text-white/85 transition hover:border-metallic-orange/45 hover:text-white";

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={hiddenValue} readOnly />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`${idPrefix}-age-lo`} className={labelClass}>
          Age range
        </label>
        <div className="flex gap-2 text-[10px] uppercase tracking-wider">
          <button
            type="button"
            className={
              mode === "numeric"
                ? "text-metallic-orange"
                : "text-white/45 hover:text-white/70"
            }
            onClick={() => setMode("numeric")}
          >
            Numbers
          </button>
          <span className="text-white/25" aria-hidden>
            |
          </span>
          <button
            type="button"
            className={
              mode === "custom"
                ? "text-metallic-orange"
                : "text-white/45 hover:text-white/70"
            }
            onClick={() => setMode("custom")}
          >
            Custom text
          </button>
        </div>
      </div>

      {mode === "numeric" ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            <div>
              <label
                htmlFor={`${idPrefix}-age-lo`}
                className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-metallic-orange/75"
              >
                Low (years)
              </label>
              <input
                id={`${idPrefix}-age-lo`}
                type="number"
                inputMode="numeric"
                min={MIN_AGE}
                max={MAX_AGE}
                autoComplete="off"
                value={lo}
                onChange={(e) => setLo(e.target.value)}
                className={inputClass}
                placeholder="e.g. 45"
              />
            </div>
            <div>
              <label
                htmlFor={`${idPrefix}-age-hi`}
                className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-metallic-orange/75"
              >
                High (years)
              </label>
              <input
                id={`${idPrefix}-age-hi`}
                type="number"
                inputMode="numeric"
                min={MIN_AGE}
                max={MAX_AGE}
                autoComplete="off"
                value={hi}
                onChange={(e) => setHi(e.target.value)}
                className={inputClass}
                placeholder="e.g. 55"
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
              Quick presets
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className={presetBtn}
                  onClick={() => {
                    setLo(String(p.lo));
                    setHi(String(p.hi));
                  }}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                className={`${presetBtn} border-white/10 text-white/50`}
                onClick={() => {
                  setLo("");
                  setHi("");
                }}
              >
                Clear
              </button>
            </div>
          </div>
          <p className="text-[11px] text-white/40">
            Submits as{" "}
            <span className="text-white/55">
              {hiddenValue || "…"}
            </span>
            {hiddenValue ? "" : " — set both low and high, or switch to custom text."}
          </p>
        </>
      ) : (
        <>
          <input
            id={`${idPrefix}-age-custom`}
            type="text"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={inputClass}
            placeholder='e.g. "late 40s" (display only — not used for numeric search)'
          />
          <p className="text-[11px] text-white/40">
            Free text shows on the profile but won&apos;t match numeric age search unless
            it includes digits like 45-55.
          </p>
        </>
      )}
    </div>
  );
}
