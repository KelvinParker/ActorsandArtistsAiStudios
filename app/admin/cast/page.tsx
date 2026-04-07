import Link from "next/link";
import { fetchActorById } from "@/lib/actors-query";
import { createSupabaseServerClient } from "@/lib/supabase";
import { CastingForm } from "./casting-form";

export const metadata = {
  title: "Casting form — Admin",
};

type PageProps = {
  searchParams: Promise<{ edit?: string }>;
};

export default async function AdminCastPage({ searchParams }: PageProps) {
  const { edit } = await searchParams;
  const supabase = createSupabaseServerClient();

  let initialActor = null;
  if (edit?.trim()) {
    const { actor } = await fetchActorById(supabase, edit.trim());
    initialActor = actor;
  }

  return (
    <div>
      <h1
        className="mb-2 text-2xl font-bold tracking-tight text-metallic-orange md:text-3xl"
        style={{
          fontFamily:
            "var(--font-display), ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {initialActor ? `Edit — ${initialActor.name}` : "Casting form"}
      </h1>
      <p className="mb-8 text-sm text-white/50">
        {initialActor
          ? "Update casting fields and asset URLs. Changes apply immediately to the gallery."
          : "Create a character with core casting fields and image URLs. Use Clerk admin role, allowlisted email, or user ID."}
      </p>
      {!initialActor && edit?.trim() ? (
        <p className="mb-6 rounded-sm border border-metallic-orange/35 bg-metallic-orange/10 px-3 py-2 text-sm text-metallic-orange">
          No actor found for that id.{" "}
          <Link href="/admin/cast" className="underline">
            Start a new entry
          </Link>
          .
        </p>
      ) : null}
      <CastingForm initialActor={initialActor} />
    </div>
  );
}
