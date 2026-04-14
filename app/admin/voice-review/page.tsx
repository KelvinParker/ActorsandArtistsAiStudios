import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import { VoiceReviewClient, type VoiceReviewRow } from "./voice-review-client";

export const metadata = {
  title: "Voice review — Admin",
};

export default async function VoiceReviewPage() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("actors")
    .select(
      [
        "id,name,stage_name,pack_name,age_range,ethnicity,sex,height,weight,origin_city",
        "physical_description,must_keep_identity_traits,personality_archetype,role_archetype",
        "backstory_summary,primary_goal,core_wound,fatal_flaw,signature_style,fashion_style,mood_keywords",
        "market_segment,vocal_range,speech,tags,traits,search_keywords",
        "levellabs_speech_id,elevenlabs_voice_suggested_id,elevenlabs_voice_approved_at",
      ].join(","),
    )
    .not("elevenlabs_voice_suggested_id", "is", null)
    .order("name", { ascending: true });

  const rows = (error ? [] : (data ?? [])) as unknown as VoiceReviewRow[];

  return (
    <div>
      <h1
        className="mb-2 text-2xl font-bold tracking-tight text-metallic-orange md:text-3xl"
        style={{
          fontFamily: "var(--font-display), ui-sans-serif, system-ui, sans-serif",
        }}
      >
        ElevenLabs voice review
      </h1>
      <p className="mb-2 max-w-3xl text-sm text-white/55">
        A voice id is <strong className="text-white/80">optional</strong> at import but{" "}
        <strong className="text-white/80">recommended</strong> once you have a good ElevenLabs match.
        Characters can go live without it; you can always come back and add or approve ids. Suggestions
        from <code className="text-white/70">29.txt</code> land here until approved into{" "}
        <code className="text-white/70">levellabs_speech_id</code> (production; casting form + downloads).
      </p>
      <p className="mb-2 max-w-3xl text-sm text-white/55">
        <strong className="text-white/80">Today:</strong> use{" "}
        <em className="text-white/70">Copy voice-matching brief</em> below, paste it into ElevenLabs so
        their UI can guide you from description to voices (use only previews that are free for your
        plan under their terms). When you have an id you like, drop it in here or casting — or skip
        for now and backfill later.{" "}
        <strong className="text-white/80">Later:</strong> we can wire the same brief to ElevenLabs APIs
        so the platform suggests ids automatically.
      </p>
      {error ? (
        <p className="mb-6 rounded-sm border border-metallic-orange/35 bg-metallic-orange/10 px-3 py-2 text-sm text-metallic-orange">
          Could not load voice columns ({error.message}). Run{" "}
          <code className="text-white/70">npm run db:push</code> for migration{" "}
          <code className="text-white/70">20260411180000_actors_elevenlabs_voice_suggested</code>.
        </p>
      ) : null}
      <p className="mb-8 text-xs text-white/40">
        <Link href="/admin/actor-pipeline" className="text-metallic-orange underline-offset-2 hover:underline">
          ← Actor pipeline
        </Link>
        {" · "}
        <Link href="/admin/import-actors" className="text-metallic-orange underline-offset-2 hover:underline">
          Fast import
        </Link>
      </p>
      <VoiceReviewClient initialRows={rows} />
    </div>
  );
}
