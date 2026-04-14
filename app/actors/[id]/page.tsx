import Link from "next/link";
import { notFound } from "next/navigation";
import { ActorCard } from "@/app/components/ActorCard";
import { ActorHeadshotGalleryGrid } from "@/app/components/ActorHeadshotGalleryGrid";
import { getIsAdmin } from "@/lib/auth/is-admin";
import { buildProfileImageUrls } from "@/lib/actor-headshots";
import { GalleryCreateCta } from "@/app/components/GalleryCreateCta";
import { SimilarActorsSection } from "@/app/components/SimilarActorsSection";
import { CharacterBible } from "@/app/components/CharacterBible";
import { ActorTechnicalMetadata } from "@/app/components/ActorTechnicalMetadata";
import { ActorDnaLoraPanel } from "@/app/components/ActorDnaLoraPanel";
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
  const isAdmin = await getIsAdmin();
  const similarActors = await fetchSimilarActors(supabase, actor, 6);

  return (
    <div className="min-h-full bg-cinematic-black text-foreground">
      <main className="mx-auto max-w-7xl px-6 pb-16 pt-10 md:pt-14">
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
          {actor.stage_name?.trim() ? (
            <p className="mt-2 text-sm tracking-wide text-white/65">
              Stage name:{" "}
              <span className="text-white/90">{actor.stage_name.trim()}</span>
            </p>
          ) : null}
          {actor.is_user_generated ? (
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-metallic-orange/85">
              Created by user
            </p>
          ) : null}
        </header>

        {actor.pack_name?.trim() ? (
          <section
            className="mx-auto mb-8 max-w-2xl rounded-sm border border-white/10 bg-black/35 p-4 md:mb-10"
            aria-label="Library pack for this character"
          >
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-metallic-orange">
              Pack names · Field 6.1
            </h2>
            <p className="text-[11px] leading-relaxed text-white/45">
              Same <code className="text-white/55">pack_name</code> on every row in a batch — e.g. a
              full fast-food crew, grocery shift, shop bay team, or school / playground set.
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
              Crew ·{" "}
              <span className="text-white/85 normal-case tracking-normal">
                {actor.pack_name.trim()}
              </span>
            </p>
            <div className="mt-4 flex justify-center">
              <Link
                href={`/?pack=${encodeURIComponent(actor.pack_name.trim())}`}
                className="inline-flex shrink-0 items-center rounded-sm border border-metallic-orange/45 bg-metallic-orange/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-metallic-orange transition hover:bg-metallic-orange/20"
              >
                Crew gallery
              </Link>
            </div>
          </section>
        ) : null}

        <section aria-label="Headshot gallery" className="mb-0">
          <h2 className={actorProfileSectionTitle}>Profile gallery</h2>
          <p className="mx-auto mb-4 max-w-2xl text-center text-xs text-white/45">
            Standard pack: <strong className="text-white/75">three</strong> stills in{" "}
            <code className="text-white/60">headshot_urls</code> — first <span className="text-white/60">9:16</span>,
            next two <span className="text-white/60">16:9</span> — plus <span className="text-white/60">16:9</span>{" "}
            turnaround. Two stills only: side-by-side full 9:16. Click any tile for full-size view.
            {isAdmin ? (
              <>
                {" "}
                Use{" "}
                <a href="/developers" className="text-metallic-orange/90 underline hover:brightness-110">
                  Developers
                </a>{" "}
                for field IDs and export semantics.
              </>
            ) : null}
          </p>
          <ActorHeadshotGalleryGrid
            actor={actor}
            urls={profileUrls}
            enableDownloadSelection
            turnaroundUrl={actor.turnaround_url?.trim() || null}
          />
        </section>

        <ActorTechnicalMetadata actor={actor} showDocsLink={isAdmin} />

        {isAdmin ? <ActorDnaLoraPanel actorId={actor.id} actor={actor} /> : null}

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

        <section className="mt-8 md:mt-10">
          <CharacterBible actor={actor} />
        </section>

        <SimilarActorsSection actors={similarActors} />

        <GalleryCreateCta />
      </main>
    </div>
  );
}
