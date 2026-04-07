"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CastingHeightSelect, CastingPicklistSelect } from "@/app/components/CastingPicklistSelect";
import { buildProfileImageUrls } from "@/lib/actor-headshots";
import {
  CASTING_SEX_OPTIONS,
  RACE_ETHNICITY_OPTIONS,
  castingHeightFormOptions,
} from "@/lib/casting-picklists";
import { AgeRangeSelector } from "@/app/components/AgeRangeSelector";
import { trackEvent } from "@/lib/analytics";
import type { ActorRow } from "@/lib/types/actor";
import { upsertActorCastAction } from "./actions";

const inputClass =
  "mt-1 w-full rounded-sm border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-metallic-orange/50 focus:outline-none focus:ring-1 focus:ring-metallic-orange/30";
const selectClass = `${inputClass} cursor-pointer bg-black/80`;
const labelClass =
  "block text-xs font-medium uppercase tracking-wider text-metallic-orange/90";
const fileInputClass =
  "mt-1 block w-full text-xs text-white/70 file:mr-3 file:cursor-pointer file:rounded-sm file:border file:border-white/20 file:bg-black/50 file:px-2 file:py-1.5 file:text-white/90 hover:file:border-metallic-orange/40";
const textareaClass = `${inputClass} min-h-[4.5rem] resize-y`;
const commaHint =
  "Separate with commas or semicolons.";

function joinList(arr: string[] | null | undefined): string {
  return (arr ?? []).filter(Boolean).join(", ");
}

type Props = {
  initialActor: ActorRow | null;
};

function headshotSlots(
  actor: ActorRow | null,
): [string, string, string, string, string] {
  if (!actor) {
    return ["", "", "", "", ""];
  }
  const urls = buildProfileImageUrls(actor);
  return [
    urls[0] ?? "",
    urls[1] ?? "",
    urls[2] ?? "",
    urls[3] ?? "",
    urls[4] ?? "",
  ];
}

export function CastingForm({ initialActor }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(initialActor);
  const slots = headshotSlots(initialActor);
  const heightOptions = useMemo(() => castingHeightFormOptions(), []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await upsertActorCastAction(fd);
      if (result.ok) {
        trackEvent("add_actor_submit", {
          source: "admin_cast",
          mode: editing ? "edit" : "create",
        });
        if (!editing) {
          form.reset();
        }
        router.push("/admin/cast");
        router.refresh();
        return;
      }
      setError(result.error);
    });
  }

  return (
    <form
      key={initialActor?.id ?? "create"}
      onSubmit={handleSubmit}
      encType="multipart/form-data"
      className="space-y-6"
    >
      {editing ? (
        <input type="hidden" name="actor_id" value={initialActor!.id} />
      ) : null}

      <div>
        <label htmlFor="cast-name" className={labelClass}>
          Name <span className="text-metallic-orange">*</span>
        </label>
        <input
          id="cast-name"
          name="name"
          required
          defaultValue={initialActor?.name ?? ""}
          autoComplete="off"
          className={inputClass}
          placeholder="Character / performer catalog name"
        />
      </div>

      <AgeRangeSelector
        key={initialActor?.id ?? "create"}
        idPrefix="cast"
        labelClass={labelClass}
        inputClass={inputClass}
        defaultRange={initialActor?.age_range ?? null}
        defaultMin={initialActor?.age_range_min ?? null}
        defaultMax={initialActor?.age_range_max ?? null}
      />

      <CastingPicklistSelect
        id="cast-sex"
        name="sex"
        label="Sex"
        baseOptions={CASTING_SEX_OPTIONS}
        defaultValue={initialActor?.sex}
        selectClass={selectClass}
        labelClass={labelClass}
      />

      <CastingPicklistSelect
        id="cast-race"
        name="race"
        label="Race / ethnicity"
        baseOptions={RACE_ETHNICITY_OPTIONS}
        defaultValue={initialActor?.race}
        selectClass={selectClass}
        labelClass={labelClass}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <CastingHeightSelect
          id="cast-height"
          name="height"
          label="Height"
          heights={heightOptions}
          defaultValue={initialActor?.height}
          selectClass={selectClass}
          labelClass={labelClass}
        />
        <div>
          <label htmlFor="cast-weight" className={labelClass}>
            Weight
          </label>
          <input
            id="cast-weight"
            name="weight"
            defaultValue={initialActor?.weight ?? ""}
            autoComplete="off"
            className={inputClass}
            placeholder="e.g. Athletic build, ~200 lbs"
          />
        </div>
      </div>

      <fieldset className="space-y-4 rounded-sm border border-white/10 bg-black/20 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-white/70">
          Tags, traits &amp; voice
        </legend>
        <p className="text-[11px] leading-relaxed text-white/45">
          These fields appear on the character profile. {commaHint}
        </p>
        <div>
          <label htmlFor="cast-tags" className={labelClass}>
            Tags
          </label>
          <textarea
            id="cast-tags"
            name="tags"
            rows={3}
            defaultValue={joinList(initialActor?.tags)}
            autoComplete="off"
            className={textareaClass}
            placeholder="e.g. Memphis, Lead, Crime drama"
          />
          <p className="mt-1 text-[11px] text-white/40">{commaHint}</p>
        </div>
        <div>
          <label htmlFor="cast-traits" className={labelClass}>
            Character traits
          </label>
          <textarea
            id="cast-traits"
            name="traits"
            rows={3}
            defaultValue={joinList(initialActor?.traits)}
            autoComplete="off"
            className={textareaClass}
            placeholder="e.g. Gritty, loyal, guarded"
          />
          <p className="mt-1 text-[11px] text-white/40">{commaHint}</p>
        </div>
        <div>
          <label htmlFor="cast-search-keywords" className={labelClass}>
            Search keywords
          </label>
          <textarea
            id="cast-search-keywords"
            name="search_keywords"
            rows={3}
            defaultValue={joinList(initialActor?.search_keywords)}
            autoComplete="off"
            className={textareaClass}
            placeholder="Extra words for gallery search (nicknames, roles, story beats)"
          />
          <p className="mt-1 text-[11px] text-white/40">{commaHint}</p>
        </div>
        <div>
          <label htmlFor="cast-speech" className={labelClass}>
            Speech &amp; voice notes
          </label>
          <textarea
            id="cast-speech"
            name="speech"
            rows={5}
            defaultValue={initialActor?.speech ?? ""}
            autoComplete="off"
            className={textareaClass}
            placeholder="Dialect, cadence, tone — sample line or how they sound. For future ElevenLabs (or similar) voice matching."
          />
        </div>
        <div>
          <label htmlFor="cast-levellabs-speech-id" className={labelClass}>
            ElevenLabs voice ID{" "}
            <span className="font-normal normal-case text-white/40">(optional)</span>
          </label>
          <input
            id="cast-levellabs-speech-id"
            name="levellabs_speech_id"
            type="text"
            defaultValue={initialActor?.levellabs_speech_id ?? ""}
            autoComplete="off"
            className={inputClass}
            placeholder="Paste an ElevenLabs voice id when you have one"
          />
          <p className="mt-1 text-[11px] text-white/40">
            Optional hook for a future ElevenLabs (or other) API connection — same field stores the id.
            Usage and sharing are subject to ElevenLabs licensing and terms.
          </p>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-sm border border-white/10 bg-black/20 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-white/70">
          Images (URLs or uploads)
        </legend>
        <p className="text-[11px] leading-relaxed text-white/45">
          Uploads are stored under{" "}
          <code className="text-white/55">{`actor-assets/<actor-id>/<name-slug>/`}</code>{" "}
          and public URLs are saved for the gallery and download pack. Upload overrides URL
          for the same slot.
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
              defaultValue={slots[i]}
              autoComplete="off"
              className={inputClass}
              placeholder="https://…"
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
            defaultValue={initialActor?.turnaround_url ?? ""}
            autoComplete="off"
            className={inputClass}
            placeholder="https://…"
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

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm border-2 border-metallic-orange bg-metallic-orange px-5 py-3 text-sm font-semibold uppercase tracking-wider text-black transition hover:brightness-110 disabled:opacity-40"
        >
          {pending ? "Saving…" : editing ? "Save changes" : "Add to gallery"}
        </button>
        {editing ? (
          <button
            type="button"
            disabled={pending}
            className="rounded-sm border border-white/25 bg-transparent px-5 py-3 text-sm font-medium text-white/80 transition hover:border-white/45 disabled:opacity-40"
            onClick={() => router.push("/admin/cast")}
          >
            Cancel edit
          </button>
        ) : null}
      </div>
    </form>
  );
}
