import Link from "next/link";
import { notFound } from "next/navigation";
import { ActorCard } from "@/app/components/ActorCard";
import { ActorHeadshotGalleryGrid } from "@/app/components/ActorHeadshotGalleryGrid";
import { getIsAdmin } from "@/lib/auth/is-admin";
import { buildProfileImageUrls } from "@/lib/actor-headshots";
import { GalleryCreateCta } from "@/app/components/GalleryCreateCta";
import { SimilarActorsSection } from "@/app/components/SimilarActorsSection";
import { fetchActorById, fetchSimilarActors } from "@/lib/actors-query";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Actor profile section headings — size/color match Technical / Turnaround; always centered. */
const actorProfileSectionTitle =
  "mb-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-metallic-orange md:text-sm";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const supabase = createSupabaseServerClient();
  const { actor } = await fetchActorById(supabase, id);
  if (!actor) {
    return { title: "Actor — Actors and Artists Ai Studios" };
  }
  return {
    title: `${actor.name} — Actors and Artists Ai Studios`,
    description: `Character detail and technical assets for ${actor.name}.`,
  };
}

export default async function ActorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = createSupabaseServerClient();
  const { actor, error } = await fetchActorById(supabase, id);

  if (error || !actor) {
    notFound();
  }

  const profileUrls = buildProfileImageUrls(actor);
  const turnaround = actor.turnaround_url?.trim() || null;
  const isAdmin = await getIsAdmin();
  const similarActors = await fetchSimilarActors(supabase, actor, 6);

  return (
    <div className="min-h-full bg-cinematic-black text-foreground">
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10 md:pt-14">
        <nav className="mb-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 md:justify-start">
          <Link
            href="/"
            className="text-sm text-metallic-orange transition hover:brightness-110"
          >
            ← Back to gallery
          </Link>
          {similarActors.length > 0 ? (
            <a
              href="#similar-actors"
              className="inline-flex min-h-9 items-center rounded-sm border border-metallic-orange/45 bg-metallic-orange/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-metallic-orange transition hover:bg-metallic-orange/20"
            >
              See similar actors
            </a>
          ) : null}
        </nav>

        <header className="mb-8 text-center md:mb-10">
          <h1
            className="text-3xl font-bold tracking-tight text-metallic-orange md:text-4xl"
            style={{
              fontFamily:
                "var(--font-display), ui-sans-serif, system-ui, sans-serif",
            }}
          >
            {actor.name}
          </h1>
        </header>

        <section aria-label="Headshot gallery" className="mb-0">
          <h2 className={actorProfileSectionTitle}>Profile gallery</h2>
          <ActorHeadshotGalleryGrid
            actor={actor}
            urls={profileUrls}
            enableDownloadSelection
            turnaroundUrl={turnaround}
          />
        </section>

        {turnaround ? (
          <section
            aria-label="Technical and turnaround reference"
            className="pt-0"
          >
            <h2 className={actorProfileSectionTitle}>
              Technical / Turnaround View
            </h2>
            <p className="mb-6 text-center text-sm text-white/45">
              Wide-sheet reference for continuity, modeling, and pipeline work.
            </p>
            <div className="w-full overflow-hidden rounded-sm border border-white/15 bg-black/55 shadow-[0_0_0_1px_rgba(255,140,0,0.12)]">
              <img
                src={turnaround}
                alt={`${actor.name} — technical turnaround sheet`}
                className="block h-auto w-full object-contain max-h-[min(85vh,960px)]"
                loading="lazy"
                decoding="async"
              />
            </div>
          </section>
        ) : null}

        <section className="mt-12 border-t border-white/10 pt-10 md:mt-14 md:pt-12">
          <h2 className={actorProfileSectionTitle}>Character details</h2>
          <ActorCard
            actor={actor}
            showHeader={false}
            showHeroMedia={false}
            linkToProfile={false}
            showAdminControls={isAdmin}
            showCastingStatsBar
          />
        </section>

        <SimilarActorsSection actors={similarActors} />

        <GalleryCreateCta />
      </main>
    </div>
  );
}
