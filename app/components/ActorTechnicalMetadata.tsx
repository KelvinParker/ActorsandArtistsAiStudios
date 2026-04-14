"use client";

import { useCallback, useState } from "react";
import type { ActorRow } from "@/lib/types/actor";

type Props = { actor: ActorRow; showDocsLink?: boolean };

function CopyBlock({
  label,
  fieldId,
  value,
}: {
  label: string;
  fieldId: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <div className="rounded-sm border border-white/10 bg-black/40 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-metallic-orange/90">
            {fieldId}
          </span>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/85">{label}</h3>
        </div>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-sm border border-metallic-orange/50 bg-metallic-orange/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-metallic-orange transition hover:bg-metallic-orange/20"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-left text-[11px] leading-relaxed text-white/70">
        {value || "—"}
      </pre>
    </div>
  );
}

/**
 * Developer-facing strings for pipelines (ComfyUI, Higgsfield, etc.).
 */
export function ActorTechnicalMetadata({ actor, showDocsLink = false }: Props) {
  const faceDna = [
    actor.physical_description?.trim() && `physical_description (Face DNA):\n${actor.physical_description.trim()}`,
    actor.must_keep_identity_traits?.trim() &&
      `must_keep_identity_traits (Identity lock):\n${actor.must_keep_identity_traits.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const visualTone = [
    actor.mood_keywords?.trim() && `mood_keywords (Field 4.0):\n${actor.mood_keywords.trim()}`,
    actor.fashion_style?.trim() && `fashion_style (Field 3.0 — locked uniform):\n${actor.fashion_style.trim()}`,
    actor.signature_style?.trim() && `signature_style:\n${actor.signature_style.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const ids = `id: ${actor.id}
name: ${actor.name}`;

  if (!faceDna && !visualTone) {
    return (
      <section aria-label="Technical metadata" className="mt-10 border-t border-white/10 pt-10">
        <h2 className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-metallic-orange md:text-sm">
          Technical metadata
        </h2>
        <p className="text-center text-sm text-white/45">
          No Face DNA or visual tone fields yet. Add{" "}
          <code className="text-white/60">physical_description</code>,{" "}
          <code className="text-white/60">must_keep_identity_traits</code>, or{" "}
          <code className="text-white/60">mood_keywords</code> in Supabase to populate this
          block for external tools.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Technical metadata" className="mt-10 border-t border-white/10 pt-10">
      <h2 className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.28em] text-metallic-orange md:text-sm">
        Technical metadata
      </h2>
      <p className="mx-auto mb-6 max-w-2xl text-center text-xs leading-relaxed text-white/45">
        Copy these strings into ComfyUI, Higgsfield, or your own prompts.
        {showDocsLink ? (
          <>
            {" "}
            Same columns as the{" "}
            <a href="/developers" className="text-metallic-orange/90 underline hover:brightness-110">
              API / schema reference
            </a>
            .
          </>
        ) : null}
      </p>
      <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
        <CopyBlock label="Face DNA & identity lock" fieldId="2.0 · 2.1" value={faceDna || "—"} />
        <CopyBlock label="Visual tone & wardrobe" fieldId="3.0 · 4.0" value={visualTone || "—"} />
        <div className="md:col-span-2">
          <CopyBlock label="Stable identifiers" fieldId="id · name" value={ids} />
        </div>
      </div>
    </section>
  );
}
