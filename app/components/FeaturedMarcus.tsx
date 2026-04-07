"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { theme } from "@/src/constants/theme";
import { formatPlayingAgeRange } from "@/lib/playing-age";
import type { ActorRow } from "@/lib/types/actor";

const FALLBACK_COPY =
  "Memphis. African American. Age range 45-55. The grit of Dirty South—cinematic, unflinching, built for character consistency.";

const FALLBACK_TAGS = ["Memphis", "Gritty Vibe", "45-55", "Male", "African American"];

type Props = {
  actor: ActorRow | null;
  fetchFailed?: boolean;
};

function buildSummary(a: ActorRow | null): string {
  if (!a) return "";
  const band = formatPlayingAgeRange(a);
  const ageBit =
    band != null
      ? `Age range ${band}`
      : a.age?.trim()
        ? a.age.trim()
        : null;
  const parts = [
    a.race?.trim() || a.ethnicity?.trim(),
    ageBit,
    a.tags?.length ? a.tags.join(" · ") : null,
  ].filter(Boolean);
  return parts.join(" — ");
}

function tagPills(a: ActorRow | null): string[] {
  if (!a) return FALLBACK_TAGS;
  const band = formatPlayingAgeRange(a);
  const raceLine = a.race?.trim() || a.ethnicity?.trim();
  const fromDb = [
    ...(a.tags ?? []),
    ...(band ? [band] : a.age?.trim() ? [a.age.trim()] : []),
    ...(a.sex?.trim() ? [a.sex.trim()] : []),
    ...(raceLine ? [raceLine] : []),
  ].filter(Boolean);
  return fromDb.length ? Array.from(new Set(fromDb)) : FALLBACK_TAGS;
}

export function FeaturedMarcus({ actor, fetchFailed }: Props) {
  const { isSignedIn, isLoaded } = useAuth();

  const name = actor?.name ?? "Marcus King";
  const summary = buildSummary(actor);
  const description = summary || FALLBACK_COPY;
  const headshotUrl = actor?.headshot_url?.trim() || null;
  const turnaroundUrl = actor?.turnaround_url?.trim() || null;
  const pills = tagPills(actor);

  return (
    <section
      className="relative w-full max-w-6xl px-6 py-16 md:py-24"
      aria-labelledby="featured-heading"
    >
      {fetchFailed ? (
        <p className="mb-4 rounded-sm border border-metallic-orange/40 bg-metallic-orange/10 px-4 py-2 text-sm text-metallic-orange">
          Could not load character data. Showing cached layout — check Supabase
          URL, keys, and migrations.
        </p>
      ) : null}

      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-metallic-orange">
        Featured
      </p>
      <h1
        id="featured-heading"
        className="text-4xl font-bold uppercase tracking-tight text-white md:text-6xl lg:text-7xl"
        style={{
          fontFamily: "var(--font-display), ui-sans-serif, system-ui, sans-serif",
          textShadow: `0 0 60px ${theme.metallicOrange}33`,
        }}
      >
        {name}
      </h1>
      <p className="mt-4 max-w-xl text-lg text-white/70 md:text-xl">
        {description}
      </p>

      <div className="mt-10 flex flex-col items-center gap-10 lg:flex-row lg:items-start">
        {/* Headshot: intrinsic aspect ratio (portrait, square, or landscape — no forced 9:16 crop) */}
        <div className="relative w-full max-w-[min(100%,520px)] shrink-0 overflow-hidden rounded-sm border border-white/10 bg-cinematic-charcoal shadow-[0_0_0_1px_rgba(255,140,0,0.15)]">
          {headshotUrl ? (
            <div className="relative">
              <img
                src={headshotUrl}
                alt={`${name} headshot`}
                className="mx-auto block h-auto max-h-[min(85vh,880px)] w-auto max-w-full object-contain"
                loading="eager"
                decoding="async"
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/3 bg-gradient-to-t from-black/55 to-transparent"
                aria-hidden
              />
            </div>
          ) : (
            <div
              className="flex min-h-[min(50vh,560px)] flex-col items-center justify-end bg-gradient-to-b from-white/[0.07] via-transparent to-black/80 p-8 text-center"
              style={{ aspectRatio: "9 / 16", maxHeight: "min(85vh,880px)" }}
            >
              <span className="text-xs uppercase tracking-widest text-metallic-orange/90">
                Headshot placeholder
              </span>
              <span className="mt-2 text-sm text-white/50">
                Add <code className="text-white/70">headshot_url</code> in
                Supabase, or verify API keys and migrations if data is not
                loading.
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between gap-8">
          <ul className="flex flex-wrap gap-2">
            {pills.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-metallic-orange/40 bg-black/40 px-4 py-1.5 text-sm text-white/90"
              >
                {tag}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {!isLoaded ? (
              <div className="h-12 w-48 animate-pulse rounded-sm bg-white/10" />
            ) : isSignedIn ? (
              <>
                <button
                  type="button"
                  className="min-h-12 rounded-sm border-2 border-metallic-orange bg-metallic-orange px-8 py-3 text-sm font-semibold uppercase tracking-wider text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!headshotUrl}
                  title={
                    headshotUrl
                      ? undefined
                      : "Headshot not available to package yet"
                  }
                >
                  Download pack
                </button>
                <button
                  type="button"
                  className="min-h-12 rounded-sm border border-white/20 bg-transparent px-8 py-3 text-sm font-semibold uppercase tracking-wider text-white/90 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
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
                  className="min-h-12 rounded-sm border-2 border-metallic-orange bg-metallic-orange/10 px-8 py-3 text-sm font-semibold uppercase tracking-wider text-metallic-orange transition hover:bg-metallic-orange/20"
                >
                  Sign in to download
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>

      {/* Turnaround: optimized for horizontal sheets; uses full width up to max-w */}
      {turnaroundUrl ? (
        <div className="mt-16 w-full border-t border-white/10 pt-12">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-metallic-orange">
            Turnaround
          </p>
          <div className="overflow-hidden rounded-sm border border-white/10 bg-cinematic-charcoal shadow-[0_0_0_1px_rgba(255,140,0,0.12)]">
            <img
              src={turnaroundUrl}
              alt={`${name} turnaround reference`}
              className="mx-auto block h-auto max-h-[min(80vh,900px)] w-full object-contain"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
