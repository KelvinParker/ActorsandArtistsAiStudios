"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
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
import Link from "next/link";
import { buildElevenlabsVoiceMatchingBrief } from "@/lib/elevenlabs-voice-brief";
import { elevenlabsPreviewUsageNote, elevenlabsVoiceLabUrl } from "@/lib/elevenlabs-links";
import { ActorLibraryDropPanel } from "./actor-library-drop-panel";
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
  const [voiceBriefCopied, setVoiceBriefCopied] = useState(false);
  const editing = Boolean(initialActor);
  const slots = headshotSlots(initialActor);
  const heightOptions = useMemo(() => castingHeightFormOptions(), []);

  const copyVoiceBrief = useCallback(async () => {
    if (!initialActor) return;
    try {
      await navigator.clipboard.writeText(buildElevenlabsVoiceMatchingBrief(initialActor));
      setVoiceBriefCopied(true);
      setTimeout(() => setVoiceBriefCopied(false), 2500);
    } catch {
      setVoiceBriefCopied(false);
    }
  }, [initialActor]);

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
    <>
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
      <fieldset className="space-y-4 rounded-sm border border-white/10 bg-black/20 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-white/70">
          Substance
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cast-stage-name" className={labelClass}>
              Stage name
            </label>
            <input
              id="cast-stage-name"
              name="stage_name"
              defaultValue={initialActor?.stage_name ?? ""}
              autoComplete="off"
              className={inputClass}
              placeholder='e.g. Jada "J-Soul" Vance'
            />
          </div>
          <div>
            <label htmlFor="cast-vocal-range" className={labelClass}>
              Vocal range
            </label>
            <input
              id="cast-vocal-range"
              name="vocal_range"
              defaultValue={initialActor?.vocal_range ?? ""}
              autoComplete="off"
              className={inputClass}
              placeholder="e.g. Alto / Mezzo-soprano"
            />
          </div>
        </div>
        <div>
          <label htmlFor="cast-personality-archetype" className={labelClass}>
            Personality archetype
          </label>
          <input
            id="cast-personality-archetype"
            name="personality_archetype"
            defaultValue={initialActor?.personality_archetype ?? ""}
            autoComplete="off"
            className={inputClass}
            placeholder="e.g. Reluctant star / street-smart visionary"
          />
        </div>
        <div>
          <label htmlFor="cast-primary-goal" className={labelClass}>
            Key motivation
          </label>
          <textarea
            id="cast-primary-goal"
            name="primary_goal"
            rows={3}
            defaultValue={initialActor?.primary_goal ?? ""}
            autoComplete="off"
            className={textareaClass}
            placeholder="What they want most and why."
          />
        </div>
        <div>
          <label htmlFor="cast-must-keep-traits" className={labelClass}>
            Must-keep identity traits
          </label>
          <textarea
            id="cast-must-keep-traits"
            name="must_keep_identity_traits"
            rows={3}
            defaultValue={initialActor?.must_keep_identity_traits ?? ""}
            autoComplete="off"
            className={textareaClass}
            placeholder="Face geometry, hair rules, non-negotiable identity markers."
          />
        </div>
      </fieldset>

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
        id="cast-ethnicity"
        name="ethnicity"
        label="Ethnicity"
        baseOptions={RACE_ETHNICITY_OPTIONS}
        defaultValue={initialActor?.ethnicity ?? null}
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
          Tags, pack, traits &amp; voice
        </legend>
        <p className="text-[11px] leading-relaxed text-white/45">
          These fields appear on the character profile. {commaHint}
        </p>
        <div>
          <label htmlFor="cast-pack-name" className={labelClass}>
            Pack name <span className="font-normal text-white/45">(Field 6.1)</span>
          </label>
          <input
            id="cast-pack-name"
            name="pack_name"
            defaultValue={initialActor?.pack_name ?? ""}
            autoComplete="off"
            className={inputClass}
            placeholder='e.g. The Retail Tech Crew — any label you choose'
          />
          <p className="mt-1 text-[11px] text-white/40">
            Type any crew or batch name. Characters with the exact same text (after trim) group
            together in the gallery pack filter and profile “Crew gallery” link.
          </p>
        </div>
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
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyVoiceBrief()}
              className="rounded-sm border border-metallic-orange/40 bg-metallic-orange/10 px-3 py-1.5 text-xs font-medium text-metallic-orange hover:bg-metallic-orange/20"
            >
              {voiceBriefCopied ? "Copied" : "Copy voice-matching brief for ElevenLabs"}
            </button>
            <span className="text-[11px] text-white/40">
              Paste into ElevenLabs only for previews/listening that are <strong className="text-white/55">free</strong>{" "}
              for your plan under their terms. Voice id is optional at first; when you have one, paste it
              below or into <code className="text-white/50">29.txt</code> before import (recommended). You
              can backfill any time.
            </span>
          </div>
        ) : null}
        <div>
          <label htmlFor="cast-levellabs-speech-id" className={labelClass}>
            ElevenLabs voice ID{" "}
            <span className="font-normal normal-case text-white/40">
              (optional — recommended when matched)
            </span>
          </label>
          <input
            id="cast-levellabs-speech-id"
            name="levellabs_speech_id"
            type="text"
            defaultValue={initialActor?.levellabs_speech_id ?? ""}
            autoComplete="off"
            className={inputClass}
            placeholder="Leave blank until you have a voice; add or change later anytime"
          />
          <p className="mt-1 text-[11px] text-white/40">
            Production id for downloads and future TTS. Fine to ship without it and backfill later.{" "}
            {elevenlabsPreviewUsageNote}
          </p>
        </div>
        {initialActor?.elevenlabs_voice_suggested_id?.trim() ? (
          <div className="rounded-sm border border-metallic-orange/25 bg-metallic-orange/10 p-3">
            <p className={labelClass}>Suggested ElevenLabs voice (from import / AI)</p>
            <code className="mt-1 block break-all text-sm text-white/85">
              {initialActor.elevenlabs_voice_suggested_id.trim()}
            </code>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <a
                href={elevenlabsVoiceLabUrl(initialActor.elevenlabs_voice_suggested_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-metallic-orange underline-offset-2 hover:underline"
              >
                Open suggested id in ElevenLabs
              </a>
              <Link
                href="/admin/voice-review"
                className="text-metallic-orange underline-offset-2 hover:underline"
              >
                Voice review queue
              </Link>
            </div>
            {initialActor.elevenlabs_voice_approved_at ? (
              <p className="mt-2 text-[11px] text-white/45">
                Last voice approval:{" "}
                {new Date(initialActor.elevenlabs_voice_approved_at).toLocaleString()}
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-white/45">
                Not marked approved yet — optional step: use Voice review to promote this suggestion into
                production, or paste a different id above when you are ready.
              </p>
            )}
          </div>
        ) : null}
      </fieldset>

      <fieldset className="space-y-3 rounded-sm border border-white/10 bg-black/20 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-white/70">
          Images (URLs or uploads)
        </legend>
        <p className="text-[11px] leading-relaxed text-white/45">
          Uploads are stored under{" "}
          <code className="text-white/55">{`actor-assets/<actor-id>/<name-slug>/`}</code>{" "}
          and public URLs are saved for the gallery and download pack. Upload overrides URL
          for the same slot. Target pack: <span className="text-white/55">four</span> images — slot{" "}
          <span className="text-white/55">1</span> <span className="text-white/40">9:16</span>, slots{" "}
          <span className="text-white/55">2–3</span> <span className="text-white/40">16:9</span> stills,
          turnaround <span className="text-white/40">16:9 horizontal</span>.
        </p>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-sm border border-white/10 bg-black/25 p-3">
            <label htmlFor={`headshot_${i}`} className={labelClass}>
              Headshot {i + 1} — URL
              {i === 0 ? (
                <span className="font-normal normal-case text-white/40">
                  {" "}
                  (9:16 hero · gallery cover)
                </span>
              ) : i === 1 || i === 2 ? (
                <span className="font-normal normal-case text-white/40">
                  {" "}
                  (16:9 still)
                </span>
              ) : (
                <span className="font-normal normal-case text-white/40">
                  {" "}
                  (optional extra)
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
            <span className="font-normal normal-case text-white/40"> (16:9 horizontal sheet)</span>
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
    {editing && initialActor ? (
      <div className="mt-8">
        <ActorLibraryDropPanel actorId={initialActor.id} actorName={initialActor.name} />
      </div>
    ) : null}
    </>
  );
}
