import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/is-admin";
import { AuthStatusButton } from "../components/AuthStatusButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Studio — Actors and Artists",
};

function ActionCard({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <article className="rounded-sm border border-white/10 bg-black/35 p-4">
      <h3
        className="text-lg font-semibold tracking-tight text-metallic-orange"
        style={{
          fontFamily: "var(--font-display), ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-white/70">{body}</p>
      <Link
        href={href}
        className="mt-4 inline-block rounded-sm border border-metallic-orange/45 bg-black/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-metallic-orange transition hover:bg-black/70"
      >
        {cta}
      </Link>
    </article>
  );
}

export default async function StudioPage() {
  const { userId } = await auth();
  const isAdmin = userId ? await getIsAdmin() : false;

  return (
    <div className="min-h-full bg-cinematic-black text-foreground">
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10 md:pt-14">
        <header className="mb-8">
          <h1
            className="text-3xl font-bold tracking-tight text-metallic-orange md:text-4xl"
            style={{
              fontFamily: "var(--font-display), ui-sans-serif, system-ui, sans-serif",
            }}
          >
            Studio
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
            Click-through dashboard for both casting users and admins: shortlist
            workflows, pack delivery, and curation operations.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em]">
            <AuthStatusButton />
            <Link
              href="/"
              className="rounded-sm border border-white/15 bg-black/40 px-2 py-1 text-white/65 transition hover:border-metallic-orange/45 hover:text-metallic-orange"
            >
              Open user view
            </Link>
            {isAdmin ? (
              <Link
                href="/admin/cast"
                className="rounded-sm border border-metallic-orange/45 bg-metallic-orange/10 px-2 py-1 text-metallic-orange transition hover:brightness-110"
              >
                Open admin view
              </Link>
            ) : (
              <span className="rounded-sm border border-white/15 bg-black/40 px-2 py-1 text-white/50">
                Admin tools hidden
              </span>
            )}
          </div>
        </header>

        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
            User Workflow
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ActionCard
              title="Discover & Search"
              body="Browse cards, run age-overlap search, inspect profiles, and narrow talent quickly."
              href="/"
              cta="Open gallery"
            />
            <ActionCard
              title="Shortlist with Favorites"
              body="Heart favorites, switch to Favs, then Select a subset for delivery."
              href="/?view=favs"
              cta="Open favs flow"
            />
            <ActionCard
              title="Deliver Character Packs"
              body="Download selected or full favorite packs with headshots + character manifests."
              href="/"
              cta="Download packs"
            />
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
            Admin Workflow
          </h2>
          {isAdmin ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <ActionCard
                title="Casting Editor"
                body="Edit age ranges, race/sex/height/weight, tags, traits, speech, and upload assets."
                href="/admin/cast"
                cta="Open casting"
              />
              <ActionCard
                title="Quick Add Character"
                body="Create new character rows quickly with core profile and asset fields."
                href="/admin/add-actor"
                cta="Quick add"
              />
              <ActionCard
                title="Admin Delivery"
                body="Use in-card admin controls (Edit/Delete/Download pack) for rapid handoff."
                href="/"
                cta="Go to admin gallery"
              />
            </div>
          ) : (
            <p className="rounded-sm border border-white/15 bg-black/35 px-4 py-3 text-sm text-white/60">
              Admin-only tools are hidden for your account. Sign in as an admin to
              preview casting operations from this screen.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
            Suggested Test Run
          </h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-white/65">
            <li>Favorite 4 characters in the gallery.</li>
            <li>Open Favs and Select 2 of them.</li>
            <li>Download selected, then download all favs.</li>
            <li>Open a zip and confirm character manifest files.</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
