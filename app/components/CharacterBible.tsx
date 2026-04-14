"use client";

import type { ActorRow } from "@/lib/types/actor";

function scriptTextFor(actor: ActorRow): string {
  const lines = [
    `${actor.stage_name?.trim() || actor.name} (${actor.name})`,
    "",
    `Age Range: ${actor.age_range || "N/A"}`,
    `Vocal Range: ${actor.vocal_range || "N/A"}`,
    `Personality Archetype: ${actor.personality_archetype || "N/A"}`,
    `Key Motivation: ${actor.primary_goal || "N/A"}`,
    `Must-Keep Identity Traits: ${actor.must_keep_identity_traits || "N/A"}`,
    `Traits: ${(actor.traits ?? []).join(", ") || "N/A"}`,
    `Speech: ${actor.speech || "N/A"}`,
    `Origin City: ${actor.origin_city || "N/A"}`,
    "",
    "Backstory:",
    actor.backstory_summary || "N/A",
  ];
  return lines.join("\n");
}

export function CharacterBible({ actor }: { actor: ActorRow }) {
  const stageName = actor.stage_name?.trim() || actor.name;
  const exportScript = () => {
    const text = scriptTextFor(actor);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${stageName.replace(/[^\w-]+/g, "_")}_script_profile.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-sm border border-white/10 bg-black/35 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-metallic-orange">
          Dirty South Character Sheet
        </h3>
        <button
          type="button"
          onClick={exportScript}
          className="rounded-sm border border-metallic-orange/45 bg-black/45 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-metallic-orange transition hover:bg-black/65"
        >
          Export to Script
        </button>
      </div>
      <div className="grid gap-3 text-sm text-white/85 md:grid-cols-2">
        <p>
          <span className="text-metallic-orange/90">Stage Name:</span> {stageName}
        </p>
        <p>
          <span className="text-metallic-orange/90">Vocal Range:</span> {actor.vocal_range || "N/A"}
        </p>
        <p>
          <span className="text-metallic-orange/90">Personality Archetype:</span>{" "}
          {actor.personality_archetype || "N/A"}
        </p>
        <p>
          <span className="text-metallic-orange/90">Key Motivation:</span>{" "}
          {actor.primary_goal || "N/A"}
        </p>
      </div>
      <div className="mt-3 text-sm text-white/85">
        <p>
          <span className="text-metallic-orange/90">Must-Keep Identity Traits:</span>{" "}
          {actor.must_keep_identity_traits || "N/A"}
        </p>
      </div>
      {actor.backstory_summary?.trim() ? (
        <div className="mt-3 border-t border-white/10 pt-3 text-sm text-white/80">
          <p className="text-metallic-orange/90">Backstory Summary</p>
          <p className="mt-1 whitespace-pre-wrap">{actor.backstory_summary.trim()}</p>
        </div>
      ) : null}
    </section>
  );
}
