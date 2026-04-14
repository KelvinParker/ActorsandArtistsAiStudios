import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthStatusButton } from "@/app/components/AuthStatusButton";
import { CreateCharacterForm } from "./create-form";

export const metadata = {
  title: "Create Character — Actors and Artists",
};

export default async function CreatePage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-full bg-cinematic-black text-foreground">
      <main className="mx-auto max-w-3xl px-6 pb-16 pt-10 md:pt-14">
        <header className="mb-7">
          <div className="mb-3 flex justify-end">
            <AuthStatusButton />
          </div>
          <h1
            className="text-3xl font-bold tracking-tight text-metallic-orange md:text-4xl"
            style={{
              fontFamily: "var(--font-display), ui-sans-serif, system-ui, sans-serif",
            }}
          >
            Create Character
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
            Generate a studio-quality character from one prompt. The platform creates profile
            attributes, headshots, and a turnaround, then saves a download-ready pack.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em]">
            <Link
              href="/studio"
              className="rounded-sm border border-white/15 bg-black/40 px-2 py-1 text-white/65 transition hover:border-metallic-orange/45 hover:text-metallic-orange"
            >
              Back to studio
            </Link>
          </div>
        </header>

        <section className="rounded-sm border border-white/10 bg-black/30 p-5 md:p-6">
          <CreateCharacterForm />
        </section>
      </main>
    </div>
  );
}
