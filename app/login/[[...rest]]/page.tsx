import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign in — Actors and Artists Ai Studios",
};

export default async function LoginPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/studio");
  }

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
              fontFamily: "var(--font-display), ui-sans-serif, system-ui, sans-serif",
            }}
          >
            Enter the Studio
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
            Discover, shortlist, and export cinematic character packs built for
            casting, pre-production, and cross-platform AI consistency.
          </p>

          <div className="mt-6 overflow-hidden rounded-sm border border-white/10 bg-black/40">
            <div className="border-b border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Studio intro video
            </div>
            <video
              className="aspect-video w-full bg-black"
              src="/videos/studio-intro.mp4"
              poster="/next.svg"
              controls
              preload="metadata"
            />
            <p className="px-3 py-2 text-[11px] text-white/50">
              Add your teaser at{" "}
              <code className="text-white/65">public/videos/studio-intro.mp4</code>.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">
            <Link
              href="/"
              className="rounded-sm border border-white/20 bg-black/45 px-3 py-1.5 font-semibold uppercase tracking-[0.16em] text-white/75 transition hover:border-metallic-orange/45 hover:text-metallic-orange"
            >
              Back to gallery
            </Link>
            <Link
              href="/studio"
              className="rounded-sm border border-metallic-orange/45 bg-metallic-orange/10 px-3 py-1.5 font-semibold uppercase tracking-[0.16em] text-metallic-orange transition hover:brightness-110"
            >
              Studio overview
            </Link>
          </div>
        </section>

        <section className="flex justify-center md:justify-end">
          <div className="w-full max-w-md rounded-sm border border-white/10 bg-black/35 p-2">
            <SignIn path="/login" routing="path" signUpUrl="/sign-up" />
          </div>
        </section>
      </main>
    </div>
  );
}
