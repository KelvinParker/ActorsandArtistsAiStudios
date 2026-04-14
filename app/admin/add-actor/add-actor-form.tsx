"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CastingHeightSelect, CastingPicklistSelect } from "@/app/components/CastingPicklistSelect";
import {
  CASTING_SEX_OPTIONS,
  RACE_ETHNICITY_OPTIONS,
  castingHeightFormOptions,
} from "@/lib/casting-picklists";
import { trackEvent } from "@/lib/analytics";
import { AgeRangeSelector } from "@/app/components/AgeRangeSelector";
import { addActorAction } from "./actions";

const inputClass =
  "mt-1 w-full rounded-sm border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-metallic-orange/50 focus:outline-none focus:ring-1 focus:ring-metallic-orange/30";
const selectClass = `${inputClass} cursor-pointer bg-black/80`;
const labelClass = "block text-xs font-medium uppercase tracking-wider text-metallic-orange/90";
const fileInputClass =
  "mt-1 block w-full text-xs text-white/70 file:mr-3 file:cursor-pointer file:rounded-sm file:border file:border-white/20 file:bg-black/50 file:px-2 file:py-1.5 file:text-white/90 hover:file:border-metallic-orange/40";

export function AddActorForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const heightOptions = useMemo(() => castingHeightFormOptions(), []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await addActorAction(fd);
      if (result.ok) {
        trackEvent("add_actor_submit", {
          source: "admin_quick_add",
          mode: "create",
        });
        form.reset();
        router.push("/");
        router.refresh();
        return;
      }
      setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-6">
      <fieldset className="space-y-3 rounded-sm border border-metallic-orange/35 bg-metallic-orange/5 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-metallic-orange">
          Automation Pipeline (A-D)
        </legend>
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input
            type="checkbox"
            id="auto_generate"
            name="auto_generate"
            defaultChecked
            className="h-4 w-4 accent-metallic-orange"
          />
          Enable 1-prompt auto character generation
        </label>
        <div>
          <label htmlFor="seed_prompt" className={labelClass}>
            Seed prompt (required for auto mode)
          </label>
          <textarea
            id="seed_prompt"
            name="seed_prompt"
            rows={3}
            className={inputClass}
            placeholder="One sentence concept, e.g. Ruthless but loyal Memphis kingpin strategist in her 30s."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="headshot_provider" className={labelClass}>
              Headshot provider
            </label>
            <select
              id="headshot_provider"
              name="headshot_provider"
              className={selectClass}
              defaultValue="flow"
            >
              <option value="flow">Google Flow + Nano Banana</option>
              <option value="flux">Flux (fallback)</option>
            </select>
          </div>
          <div>
            <label htmlFor="turnaround_provider" className={labelClass}>
              Turnaround provider
            </label>
            <select
              id="turnaround_provider"
              name="turnaround_provider"
              className={selectClass}
              defaultValue="nano-banana"
            >
              <option value="nano-banana">Nano Banana (Google Flow)</option>
              <option value="flux">Flux (fallback)</option>
            </select>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-white/55">
          A) Gemini expands identity. B) Flux generates master face. C) Consistency set is
          generated and turnaround can route to Nano Banana (Flow). D) Assets are mirrored to
          Supabase and saved to actor row.
        </p>
      </fieldset>

      <div>
        <label htmlFor="name" className={labelClass}>
          Name <span className="text-metallic-orange">*</span>
        </label>
        <input
          id="name"
          name="name"
          required
          autoComplete="off"
          className={inputClass}
          placeholder="e.g. Marcus King"
        />
      </div>
      <div>
        <label htmlFor="stage_name" className={labelClass}>
          Stage name
        </label>
        <input
          id="stage_name"
          name="stage_name"
          autoComplete="off"
          className={inputClass}
          placeholder='e.g. Jada "J-Soul" Vance'
        />
      </div>

      <AgeRangeSelector
        idPrefix="add-actor"
        labelClass={labelClass}
        inputClass={inputClass}
      />

      <CastingPicklistSelect
        id="add-actor-ethnicity"
        name="ethnicity"
        label="Ethnicity"
        baseOptions={RACE_ETHNICITY_OPTIONS}
        defaultValue={null}
        selectClass={selectClass}
        labelClass={labelClass}
      />

      <CastingPicklistSelect
        id="sex"
        name="sex"
        label="Sex"
        baseOptions={CASTING_SEX_OPTIONS}
        defaultValue={null}
        selectClass={selectClass}
        labelClass={labelClass}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <CastingHeightSelect
          id="height"
          name="height"
          label="Height"
          heights={heightOptions}
          defaultValue={null}
          selectClass={selectClass}
          labelClass={labelClass}
        />
        <div>
          <label htmlFor="weight" className={labelClass}>
            Weight
          </label>
          <input
            id="weight"
            name="weight"
            autoComplete="off"
            className={inputClass}
            placeholder="e.g. ~195 lbs"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="origin_city" className={labelClass}>
            Origin city
          </label>
          <input
            id="origin_city"
            name="origin_city"
            autoComplete="off"
            className={inputClass}
            placeholder="e.g. Memphis, TN"
          />
        </div>
        <div>
          <label htmlFor="market_segment" className={labelClass}>
            Market segment
          </label>
          <input
            id="market_segment"
            name="market_segment"
            autoComplete="off"
            className={inputClass}
            placeholder="e.g. Lead / Supporting / Antagonist"
          />
        </div>
      </div>
      <div>
        <label htmlFor="signature_style" className={labelClass}>
          Signature style
        </label>
        <input
          id="signature_style"
          name="signature_style"
          autoComplete="off"
          className={inputClass}
          placeholder="Wardrobe/aesthetic shorthand"
        />
      </div>
      <div>
        <label htmlFor="fashion_style" className={labelClass}>
          Fashion style (locked uniform) <span className="font-normal text-white/45">(Field 3.0)</span>
        </label>
        <input
          id="fashion_style"
          name="fashion_style"
          autoComplete="off"
          className={inputClass}
          placeholder="Standard clothing set for continuity"
        />
      </div>
      <div>
        <label htmlFor="mood_keywords" className={labelClass}>
          Mood / visual tone <span className="font-normal text-white/45">(Field 4.0)</span>
        </label>
        <input
          id="mood_keywords"
          name="mood_keywords"
          autoComplete="off"
          className={inputClass}
          placeholder="e.g. Neon-purple, low-key amber, high-contrast noir"
        />
      </div>
      <div>
        <label htmlFor="backstory_summary" className={labelClass}>
          Backstory summary
        </label>
        <textarea
          id="backstory_summary"
          name="backstory_summary"
          rows={2}
          className={inputClass}
          placeholder="Short narrative synopsis"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="primary_goal" className={labelClass}>
            Primary goal
          </label>
          <input
            id="primary_goal"
            name="primary_goal"
            autoComplete="off"
            className={inputClass}
            placeholder="Core objective"
          />
        </div>
        <div>
          <label htmlFor="core_wound" className={labelClass}>
            Core wound
          </label>
          <input
            id="core_wound"
            name="core_wound"
            autoComplete="off"
            className={inputClass}
            placeholder="Internal pain point"
          />
        </div>
      </div>
      <div>
        <label htmlFor="fatal_flaw" className={labelClass}>
          Fatal flaw
        </label>
        <input
          id="fatal_flaw"
          name="fatal_flaw"
          autoComplete="off"
          className={inputClass}
          placeholder="Trait that creates conflict risk"
        />
      </div>
      <fieldset className="space-y-3 rounded-sm border border-metallic-orange/25 bg-black/25 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-metallic-orange/90">
          Face DNA & identity lock (Field 2.0 / 2.1)
        </legend>
        <div>
          <label htmlFor="physical_description" className={labelClass}>
            Physical description (Face DNA)
          </label>
          <textarea
            id="physical_description"
            name="physical_description"
            rows={3}
            className={inputClass}
            placeholder="Distinct features: eyes, skin tone, facial hair, bone structure…"
          />
        </div>
        <div>
          <label htmlFor="must_keep_identity_traits" className={labelClass}>
            Must-keep identity traits
          </label>
          <textarea
            id="must_keep_identity_traits"
            name="must_keep_identity_traits"
            rows={3}
            className={inputClass}
            placeholder="Non-negotiables for AI consistency across shots"
          />
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="vocal_range" className={labelClass}>
            Vocal range
          </label>
          <input
            id="vocal_range"
            name="vocal_range"
            autoComplete="off"
            className={inputClass}
            placeholder="e.g. Alto / Mezzo-soprano"
          />
        </div>
        <div>
          <label htmlFor="personality_archetype" className={labelClass}>
            Motivation
          </label>
          <input
            id="personality_archetype"
            name="personality_archetype"
            autoComplete="off"
            className={inputClass}
            placeholder="e.g. Soulful underdog chasing legacy"
          />
        </div>
      </div>

      <div>
        <label htmlFor="tags" className={labelClass}>
          Tags <span className="font-normal text-white/45">(Field 6.0)</span>
        </label>
        <input
          id="tags"
          name="tags"
          autoComplete="off"
          className={inputClass}
          placeholder="Comma-separated: Memphis, Gritty, Lead"
        />
        <p className="mt-1 text-[11px] text-white/40">
          Separate with commas or semicolons. Stored as a text array in Supabase.
        </p>
      </div>

      <div>
        <label htmlFor="pack_name" className={labelClass}>
          Pack name <span className="font-normal text-white/45">(Field 6.1)</span>
        </label>
        <input
          id="pack_name"
          name="pack_name"
          autoComplete="off"
          className={inputClass}
          placeholder="e.g. Riverside Drive-Thru — Night Shift, The Retail Tech Crew"
        />
        <p className="mt-1 text-[11px] text-white/40">
          Any label you want. Use the same spelling for every character in a crew so they stay
          grouped in the gallery pack filter.
        </p>
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>
          Production notes <span className="font-normal text-white/45">(Field 7.0)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className={inputClass}
          placeholder="Ops / production-only notes"
        />
      </div>

      <fieldset className="space-y-3 rounded-sm border border-white/10 bg-black/20 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-white/70">
          Image URLs
        </legend>
        <p className="text-[11px] leading-relaxed text-white/45">
          Files go to Supabase Storage bucket{" "}
          <code className="text-white/60">{`actor-assets/<actor-id>/<name-slug>/`}</code>{" "}
          (created when you save). Public URLs are written to{" "}
          <code className="text-white/60">headshot_urls</code> /{" "}
          <code className="text-white/60">turnaround_url</code> for the gallery and download
          pack. If you both paste a URL and upload a file for a slot, the upload wins.
        </p>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-sm border border-white/10 bg-black/25 p-3">
            <label htmlFor={`headshot_${i}`} className={labelClass}>
              Headshot {i + 1} — URL
              {i === 0 ? (
                <span className="font-normal normal-case text-white/40">
                  {" "}
                  (gallery cover)
                </span>
              ) : (
                <span className="font-normal normal-case text-white/40">
                  {" "}
                  (profile only)
                </span>
              )}
            </label>
            <input
              id={`headshot_${i}`}
              name={`headshot_${i}`}
              type="url"
              inputMode="url"
              autoComplete="off"
              className={inputClass}
              placeholder="https://… (optional if uploading)"
            />
            <label htmlFor={`headshot_file_${i}`} className={`${labelClass} mt-2`}>
              Headshot {i + 1} — upload
            </label>
            <input
              id={`headshot_file_${i}`}
              name={`headshot_file_${i}`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className={fileInputClass}
            />
          </div>
        ))}
        <div className="rounded-sm border border-white/10 bg-black/25 p-3">
          <label htmlFor="turnaround" className={labelClass}>
            Turnaround — URL
          </label>
          <input
            id="turnaround"
            name="turnaround"
            type="url"
            inputMode="url"
            autoComplete="off"
            className={inputClass}
            placeholder="https://… (optional)"
          />
          <label htmlFor="turnaround_file" className={`${labelClass} mt-2`}>
            Turnaround — upload
          </label>
          <input
            id="turnaround_file"
            name="turnaround_file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className={fileInputClass}
          />
        </div>
      </fieldset>

      {error ? (
        <p
          className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-sm border-2 border-metallic-orange bg-metallic-orange px-4 py-3 text-sm font-semibold uppercase tracking-wider text-black transition hover:brightness-110 disabled:opacity-40"
      >
        {pending ? "Saving…" : "Add actor"}
      </button>
    </form>
  );
}
