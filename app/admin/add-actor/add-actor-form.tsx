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

      <AgeRangeSelector
        idPrefix="add-actor"
        labelClass={labelClass}
        inputClass={inputClass}
      />

      <CastingPicklistSelect
        id="add-actor-race"
        name="race"
        label="Race / ethnicity"
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

      <div>
        <label htmlFor="tags" className={labelClass}>
          Tags
        </label>
        <input
          id="tags"
          name="tags"
          autoComplete="off"
          className={inputClass}
          placeholder="Comma-separated: Memphis, Gritty, Lead"
        />
        <p className="mt-1 text-[11px] text-white/40">
          Separate with commas or semicolons.
        </p>
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
