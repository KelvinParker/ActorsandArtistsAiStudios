"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  TAXONOMY_CATEGORY_ORDER,
  TAXONOMY_CATEGORY_LABELS,
  type TaxonomyCategory,
} from "@/lib/constants/taxonomy-categories";

type Props = {
  actorId: string;
};

export function ActorTaxonomyEditor({ actorId }: Props) {
  const router = useRouter();
  const [category, setCategory] = useState<TaxonomyCategory>("race_ethnicity");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const trimmed = label.trim();
    if (!trimmed) {
      setMessage("Enter a value to tag (or match an existing term exactly).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/actors/${actorId}/taxonomy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, label: trimmed }),
      });
      const json = (await res.json()) as {
        error?: string;
        ok?: boolean;
        alreadyLinked?: boolean;
      };
      if (!res.ok) {
        setMessage(json.error ?? "Request failed");
        return;
      }
      if (json.alreadyLinked) {
        setMessage("This character already has that tag.");
      } else {
        setMessage(
          "Saved. New values are added to the platform vocabulary for everyone.",
        );
      }
      setLabel("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 space-y-3 rounded-sm border border-white/10 bg-black/30 p-3.5"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-metallic-orange/90">
        Add casting tag
      </p>
      <p className="text-xs leading-relaxed text-white/55">
        Pick a category and type a value. If it is new, we store it and make it
        selectable for other characters.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor={`tax-cat-${actorId}`}>
          Category
        </label>
        <select
          id={`tax-cat-${actorId}`}
          className="rounded-sm border border-white/15 bg-black/50 px-2.5 py-2 text-sm text-white"
          value={category}
          onChange={(e) => setCategory(e.target.value as TaxonomyCategory)}
        >
          {TAXONOMY_CATEGORY_ORDER.map((k) => (
            <option key={k} value={k}>
              {TAXONOMY_CATEGORY_LABELS[k]}
            </option>
          ))}
        </select>
        <input
          className="min-w-0 flex-1 rounded-sm border border-white/15 bg-black/50 px-2.5 py-2 text-sm text-white placeholder:text-white/30"
          placeholder="Exact label (matches seeded vocabulary or creates new)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={120}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-sm border border-metallic-orange/60 bg-metallic-orange/15 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-metallic-orange transition hover:bg-metallic-orange/25 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Add"}
        </button>
      </div>
      {message ? (
        <p className="text-xs text-white/60">{message}</p>
      ) : null}
    </form>
  );
}
