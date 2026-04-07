"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { deleteActorAction } from "@/app/admin/cast/actions";
import { buildProfileImageUrls } from "@/lib/actor-headshots";
import type { ActorRow } from "@/lib/types/actor";
import { ActorProfileStatsBar } from "./ActorProfileStatsBar";
import { ActorTaxonomyEditor } from "./ActorTaxonomyEditor";
import { downloadCharacterPack } from "./download-character-pack";

type Props = {
  actor: ActorRow;
  /** Hide title + catalog blurb (detail page has its own header). */
  showHeader?: boolean;
  /** Hide headshot carousel + inline turnaround (detail page shows grid + Technical view). */
  showHeroMedia?: boolean;
  /** Link the name to `/actors/[id]` (gallery cards). */
  linkToProfile?: boolean;
  /** Edit / Delete casting controls (gallery when `getIsAdmin()` is true). */
  showAdminControls?: boolean;
  /** Actor profile: Race / Sex / Age / Height / Weight bar above traits (with character details). */
  showCastingStatsBar?: boolean;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-metallic-orange/90">
        {label}
      </p>
      <div className="mt-0.5 text-xs leading-relaxed text-white/85">{children}</div>
    </div>
  );
}

const PLACEHOLDER_FRAME =
  "min-h-[260px] sm:min-h-[300px] md:min-h-[340px] lg:min-h-[380px]";

function HeadshotCarousel({ urls, name }: { urls: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const n = urls.length;

  useEffect(() => {
    setIndex(0);
  }, [urls.join("|")]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + n) % n);
  }, [n]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % n);
  }, [n]);

  const innerMin =
    n > 1
      ? "min-h-[180px] sm:min-h-[200px] md:min-h-[220px] lg:min-h-[240px]"
      : PLACEHOLDER_FRAME;

  return (
    <div
      className="flex w-full flex-col gap-2"
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null || n <= 1) return;
        const d = e.changedTouches[0].clientX - touchX.current;
        if (d > 50) prev();
        else if (d < -50) next();
        touchX.current = null;
      }}
    >
      <div
        className={`relative flex w-full items-center justify-center overflow-hidden rounded-sm border border-white/10 bg-black/50 shadow-[0_0_0_1px_rgba(255,140,0,0.12)] ${innerMin}`}
      >
        {n > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous headshot"
              className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-sm border border-white/20 bg-black/70 px-2 py-3 text-lg leading-none text-white/90 backdrop-blur-sm transition hover:border-metallic-orange/50 hover:text-metallic-orange"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next headshot"
              className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-sm border border-white/20 bg-black/70 px-2 py-3 text-lg leading-none text-white/90 backdrop-blur-sm transition hover:border-metallic-orange/50 hover:text-metallic-orange"
            >
              ›
            </button>
          </>
        ) : null}
        <img
          src={urls[index]}
          alt={
            n > 1
              ? `${name} — profile ${index + 1} of ${n}`
              : `${name} headshot`
          }
          className="h-auto max-h-[min(78vh,760px)] w-full object-contain object-top"
          loading={index === 0 ? "eager" : "lazy"}
          decoding="async"
        />
      </div>
      {n > 1 ? (
        <div className="flex justify-center gap-2">
          {urls.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition ${
                i === index
                  ? "w-6 bg-metallic-orange"
                  : "w-2 bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ActorCard({
  actor,
  showHeader = true,
  showHeroMedia = true,
  linkToProfile = true,
  showAdminControls = false,
  showCastingStatsBar = false,
}: Props) {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [deletePending, startDeleteTransition] = useTransition();
  const [downloadPackPending, startDownloadPackTransition] = useTransition();
  const name = actor.name;
  const profileUrls = buildProfileImageUrls(actor);
  const hasProfilePhotos = profileUrls.length > 0;
  const turnaroundUrl = actor.turnaround_url?.trim() || null;
  const tags = actor.tags?.filter(Boolean) ?? [];
  const traits = actor.traits?.filter(Boolean) ?? [];
  const searchKeywords = actor.search_keywords?.filter(Boolean) ?? [];
  const taxonomy = actor.taxonomy ?? [];
  const raceTerms = taxonomy.filter((t) => t.category === "race_ethnicity");
  const raceOrEthnicity =
    [actor.race?.trim(), actor.ethnicity?.trim()].filter(Boolean).join(" · ") ||
    null;

  const hasProfile =
    showCastingStatsBar ||
    raceTerms.length > 0 ||
    Boolean(raceOrEthnicity) ||
    traits.length > 0 ||
    tags.length > 0 ||
    searchKeywords.length > 0 ||
    Boolean(actor.speech?.trim()) ||
    Boolean(actor.levellabs_speech_id?.trim());

  function handleAdminDelete() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Remove “${name}” from the gallery? This cannot be undone.`,
      )
    ) {
      return;
    }
    startDeleteTransition(async () => {
      const result = await deleteActorAction(actor.id);
      if (result.ok) {
        router.refresh();
        return;
      }
      if (typeof window !== "undefined") {
        window.alert(result.error);
      }
    });
  }

  function handleDownloadPack() {
    startDownloadPackTransition(async () => {
      try {
        await downloadCharacterPack(actor.id, name);
      } catch (err) {
        if (typeof window !== "undefined") {
          window.alert(err instanceof Error ? err.message : "Download failed.");
        }
      }
    });
  }

  const titleClass =
    "text-lg font-semibold leading-tight tracking-tight md:text-xl";
  const titleStyle = {
    fontFamily: "var(--font-display), ui-sans-serif, system-ui, sans-serif",
  } as const;

  return (
    <article className="flex flex-col gap-3">
      {showHeader ? (
        <header className="text-center">
          {linkToProfile ? (
            <Link
              href={`/actors/${actor.id}`}
              className="group mx-auto block max-w-md rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-metallic-orange/60"
            >
              <h3
                className={`${titleClass} text-metallic-orange transition group-hover:brightness-110`}
                style={titleStyle}
              >
                {name}
              </h3>
            </Link>
          ) : (
            <h3 className={`${titleClass} text-white`} style={titleStyle}>
              {name}
            </h3>
          )}
          <p className="mx-auto mt-2 max-w-md text-[10px] leading-relaxed text-white/45 md:text-[11px]">
            <span className="font-medium text-white/55">Catalog name.</span> After
            you download, you can use a different name in your script, credits,
            or project —{" "}
            <span className="text-white/60">{name}</span> is how this performer
            is identified in the Actors and Artists Ai Studios gallery.
          </p>
        </header>
      ) : null}

      {showAdminControls ? (
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href={`/admin/cast?edit=${actor.id}`}
            className="rounded-sm border border-metallic-orange/50 bg-metallic-orange/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-metallic-orange transition hover:bg-metallic-orange/25"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={handleDownloadPack}
            disabled={!hasProfilePhotos || downloadPackPending}
            className="rounded-sm border border-metallic-orange/45 bg-black/45 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-metallic-orange transition hover:bg-black/60 disabled:opacity-40"
            title={hasProfilePhotos ? undefined : "Headshot not available to package yet"}
          >
            {downloadPackPending ? "Preparing…" : "Admin download pack"}
          </button>
          <button
            type="button"
            disabled={deletePending}
            onClick={handleAdminDelete}
            className="rounded-sm border border-red-500/45 bg-red-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-200/95 transition hover:bg-red-500/20 disabled:opacity-40"
          >
            {deletePending ? "…" : "Delete"}
          </button>
        </div>
      ) : null}

      {showHeroMedia ? (
        hasProfilePhotos ? (
          <HeadshotCarousel urls={profileUrls} name={name} />
        ) : (
          <div
            className={`relative flex w-full items-center justify-center overflow-hidden rounded-sm border border-white/10 bg-black/50 shadow-[0_0_0_1px_rgba(255,140,0,0.12)] ${PLACEHOLDER_FRAME}`}
          >
            <div className="flex w-full flex-col items-center justify-center bg-gradient-to-b from-white/[0.05] to-black/60 p-6 text-center">
              <span className="text-xs text-metallic-orange/90">No headshot</span>
              <span className="mt-1 text-[10px] text-white/35">
                Add image URLs in admin or Supabase (
                <code className="text-white/50">headshot_url</code> /{" "}
                <code className="text-white/50">headshot_urls</code>).
              </span>
            </div>
          </div>
        )
      ) : null}

      <div className="border-t border-white/10 pt-3">
        {showCastingStatsBar ? (
          <ActorProfileStatsBar actor={actor} variant="inline" />
        ) : null}
        <div className="min-h-[4.5rem] space-y-2.5">
          {raceTerms.length > 0 ? (
            <Field label="Race / ethnicity">
              <ul className="flex flex-wrap gap-1.5">
                {raceTerms.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-full border border-metallic-orange/35 bg-black/35 px-2 py-0.5 text-[11px] text-white/90"
                  >
                    {t.label}
                  </li>
                ))}
              </ul>
            </Field>
          ) : !showCastingStatsBar && raceOrEthnicity ? (
            <Field label="Race / ethnicity">{raceOrEthnicity}</Field>
          ) : null}
          {traits.length > 0 ? (
            <Field label="Character traits">
              <ul className="flex flex-wrap gap-1.5">
                {traits.map((t) => (
                  <li
                    key={t}
                    className="rounded-full border border-metallic-orange/35 bg-black/35 px-2 py-0.5 text-[11px] text-white/90"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </Field>
          ) : null}
          {tags.length > 0 ? (
            <div>
              <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-metallic-orange md:text-sm">
                World & tags
              </p>
              <ul className="mt-0.5 flex flex-wrap justify-center gap-1.5">
                {tags.map((t) => (
                  <li
                    key={t}
                    className="rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/75"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {searchKeywords.length > 0 ? (
            <Field label="Search keywords">
              <ul className="flex flex-wrap gap-1.5">
                {searchKeywords.map((t) => (
                  <li
                    key={t}
                    className="rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/75"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </Field>
          ) : null}
          {actor.speech?.trim() || actor.levellabs_speech_id?.trim() ? (
            <Field label="Speech & voice">
              {actor.speech?.trim() ? (
                <p className="whitespace-pre-wrap">{actor.speech.trim()}</p>
              ) : null}
              {actor.levellabs_speech_id?.trim() ? (
                <p className="mt-1 text-[11px] text-white/50">
                  ElevenLabs voice ID:{" "}
                  <code className="text-white/70">
                    {actor.levellabs_speech_id.trim()}
                  </code>
                </p>
              ) : null}
              <p className="mt-1 text-[11px] text-white/45">
                Voice previews and sharing are subject to ElevenLabs terms and licensing.
              </p>
            </Field>
          ) : null}
          {!hasProfile ? (
            <p className="text-[11px] text-white/40">
              Add race, traits, tags, and speech — or sign in and use casting
              tags (taxonomy migration).
            </p>
          ) : null}
        </div>

        {isLoaded && isSignedIn ? (
          <ActorTaxonomyEditor actorId={actor.id} />
        ) : null}
      </div>

      {showHeroMedia && turnaroundUrl ? (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-metallic-orange md:text-xs">
            Turnaround
          </p>
          <div className="overflow-hidden rounded-sm border border-white/10 bg-black/50">
            <img
              src={turnaroundUrl}
              alt={`${name} turnaround sheet`}
              className="block h-auto w-full object-contain max-h-[min(42vh,420px)] sm:max-h-[min(48vh,520px)] md:max-h-[min(58vh,680px)] lg:max-h-[min(62vh,820px)] xl:max-h-[min(65vh,900px)]"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      ) : null}

      {isLoaded && !isSignedIn && !showHeroMedia ? (
        <p className="mb-3 text-center text-xs text-white/45">
          Sign in to select headshots and download a zip.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        {!isLoaded ? (
          <div className="h-9 w-full animate-pulse rounded-sm bg-white/10" />
        ) : isSignedIn ? (
          <>
            <button
              type="button"
              onClick={handleDownloadPack}
              className="w-full rounded-sm border-2 border-metallic-orange bg-metallic-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 md:text-xs"
              disabled={!hasProfilePhotos || downloadPackPending}
              title={
                hasProfilePhotos
                  ? undefined
                  : "Headshot not available to package yet"
              }
            >
              {downloadPackPending ? "Preparing zip…" : "Download pack"}
            </button>
            <button
              type="button"
              className="w-full rounded-sm border border-white/20 bg-transparent px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/90 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40 md:text-xs"
              disabled={!turnaroundUrl}
              title={
                turnaroundUrl
                  ? undefined
                  : "Turnaround not generated yet (Flux)"
              }
            >
              Download turnaround
            </button>
          </>
        ) : (
          <SignInButton mode="modal">
            <button
              type="button"
              className="w-full rounded-sm border-2 border-metallic-orange bg-metallic-orange/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-metallic-orange transition hover:bg-metallic-orange/20 md:text-xs"
            >
              Sign in to download
            </button>
          </SignInButton>
        )}
      </div>
    </article>
  );
}
