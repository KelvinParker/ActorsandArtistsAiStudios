import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/is-admin";
import { fetchActorsForGallery } from "@/lib/actors-query";
import { createSupabaseServerClient } from "@/lib/supabase";
import { AuthStatusButton } from "./components/AuthStatusButton";
import { CharacterGallery } from "./components/CharacterGallery";

/** Load the full `actors` table on each request. */
export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams?: Promise<{ view?: string; mode?: string; pack?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : undefined;
  const initialFavoritesOnly = params?.view?.toLowerCase() === "favs";
  const userPreviewMode = params?.mode?.toLowerCase() === "user";
  const packParam = params?.pack;
  const initialPackFilter =
    typeof packParam === "string" && packParam.trim() ? packParam.trim() : null;
  const { userId } = await auth();
  if (!userId) {
    return (
      <div className="min-h-full bg-cinematic-black text-foreground">
        <main className="mx-auto grid min-h-screen max-w-7xl gap-8 px-6 py-10 md:grid-cols-2 md:items-center">
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-metallic-orange/90">
              Actors and Artists Ai Studios
            </p>
            <h1
              className="mt-3 text-3xl font-bold tracking-tight text-metallic-orange md:text-5xl"
              style={{
                fontFamily:
                  "var(--font-display), ui-sans-serif, system-ui, sans-serif",
              }}
            >
              Cinematic Character Studio
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
              Build shortlists, keep character consistency, and export delivery-ready
              packs for production pipelines.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs">
              <Link
                href="/login"
                className="rounded-sm border-2 border-metallic-orange bg-metallic-orange px-4 py-2 font-semibold uppercase tracking-[0.16em] text-black transition hover:brightness-110"
              >
                Enter studio
              </Link>
              <Link
                href="/studio"
                className="rounded-sm border border-white/20 bg-black/45 px-4 py-2 font-semibold uppercase tracking-[0.16em] text-white/75 transition hover:border-metallic-orange/45 hover:text-metallic-orange"
              >
                Studio overview
              </Link>
            </div>
          </section>

          <section className="overflow-hidden rounded-sm border border-white/10 bg-black/40">
            <div className="border-b border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Intro reel
            </div>
            <video
              className="aspect-video w-full bg-black"
              src="/videos/studio-intro.mp4"
              poster="/next.svg"
              controls
              preload="metadata"
            />
            <p className="px-3 py-2 text-[11px] text-white/50">
              Studio preview reel for demos and investor walk-throughs.
            </p>
          </section>
        </main>
      </div>
    );
  }

  const supabase = createSupabaseServerClient();

  const { actors, error } = await fetchActorsForGallery(supabase);
  const isAdmin = await getIsAdmin();
  const showAdminControls = isAdmin && !userPreviewMode;

  if (error) {
    console.error("[actors] Supabase fetch failed:", error.message);
  }

  return (
    <div className="min-h-full bg-cinematic-black text-foreground">
      <main className="mx-auto max-w-7xl px-6 pb-16 pt-10 md:pt-14">
        <div className="mb-4 flex justify-end">
          <AuthStatusButton />
        </div>
        <h1
          className="mb-2 text-center text-3xl font-bold tracking-tight text-metallic-orange md:text-5xl md:tracking-tight"
          style={{
            fontFamily:
              "var(--font-display), ui-sans-serif, system-ui, sans-serif",
          }}
        >
          Actors and Artists Ai Studios
        </h1>
        <h2 className="mb-6 text-center text-sm font-medium uppercase tracking-[0.2em] text-white/60 md:mb-8 md:text-base">
          Character Gallery
        </h2>

        {showAdminControls ? (
          <nav
            className="mb-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-y border-white/10 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-metallic-orange/90 md:text-xs"
            aria-label="Admin shortcuts"
          >
            <Link
              href="/admin/cast"
              className="transition hover:text-metallic-orange hover:brightness-110"
            >
              Casting — add or edit
            </Link>
            <span className="text-white/25" aria-hidden>
              |
            </span>
            <Link
              href="/studio"
              className="transition hover:text-metallic-orange hover:brightness-110"
            >
              Studio
            </Link>
            <span className="text-white/25" aria-hidden>
              |
            </span>
            <Link
              href="/developers"
              className="transition hover:text-metallic-orange hover:brightness-110"
            >
              Developers
            </Link>
            <span className="text-white/25" aria-hidden>
              |
            </span>
            <Link
              href="/admin/add-actor"
              className="transition hover:text-metallic-orange hover:brightness-110"
            >
              Quick add actor
            </Link>
            <span className="text-white/25" aria-hidden>
              |
            </span>
            <Link
              href={initialFavoritesOnly ? "/?view=favs&mode=user" : "/?mode=user"}
              className="transition text-white/70 hover:text-white"
            >
              Preview user view
            </Link>
          </nav>
        ) : (
          <nav
            className="mb-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-y border-white/10 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65 md:text-xs"
            aria-label="Studio shortcut"
          >
            <Link href="/studio" className="transition hover:text-metallic-orange">
              Studio
            </Link>
            {isAdmin ? (
              <>
                <span className="text-white/25" aria-hidden>
                  |
                </span>
                <Link
                  href={initialFavoritesOnly ? "/?view=favs" : "/"}
                  className="transition text-metallic-orange/90 hover:text-metallic-orange"
                >
                  Back to admin view
                </Link>
              </>
            ) : null}
          </nav>
        )}

        {!error && actors.length > 0 ? (
          <CharacterGallery
            actors={actors}
            isAdmin={showAdminControls}
            initialFavoritesOnly={initialFavoritesOnly}
            initialPackFilter={initialPackFilter}
          />
        ) : null}

        {error ? (
          <p
            className="mb-8 rounded-sm border border-metallic-orange/40 bg-metallic-orange/10 px-4 py-3 text-center text-sm text-metallic-orange"
            role="alert"
          >
            Could not load actors — verify your Supabase URL and API keys, and
            that the SQL migrations have been applied. The project migrations do
            not enable RLS on the actors table.
          </p>
        ) : null}

        {actors.length === 0 && !error ? (
          <p className="text-center text-white/50">
            No actors in the database yet.
          </p>
        ) : null}
      </main>
    </div>
  );
}
