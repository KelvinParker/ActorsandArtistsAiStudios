import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/is-admin";

export const metadata: Metadata = {
  title: "Developers & API — Actors and Artists Ai Studios",
  description:
    "Universal Actor Schema, Field IDs 1.0–7.0, and sample JSON for external pipelines (ComfyUI, Higgsfield).",
};

const SAMPLE_ACTOR_JSON = `{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Marcus King",
  "stage_name": null,
  "pack_name": "The Delta Blues",
  "origin_city": "Memphis, TN",
  "age_range": "38-42",
  "ethnicity": "African American",
  "sex": "Male",
  "physical_description": "Deep brown eyes, short cropped hair with subtle wave, neatly trimmed beard with hints of gray at the chin, strong jaw, warm brown skin with light weathering at the eyes.",
  "must_keep_identity_traits": "Same face geometry and skin tone across every shot; beard shape fixed; eyes remain deep brown.",
  "fashion_style": "Charcoal wool overcoat, black fitted tee, dark denim, polished boots — winter Memphis street.",
  "mood_keywords": "Low amber key, soft rim light, cinematic grit, shallow depth of field",
  "personality_archetype": "The Protector",
  "role_archetype": "Lead",
  "backstory_summary": "Memphis strategist balancing family loyalty and street pressure.",
  "speech": "Memphis drawl, measured pace; sharpens when cornered.",
  "market_segment": "Urban drama",
  "headshot_urls": [
    "https://example.supabase.co/storage/v1/object/public/actor-assets/…/hero-9x16.jpg",
    "https://example.supabase.co/storage/v1/object/public/actor-assets/…/still-a-16x9.jpg",
    "https://example.supabase.co/storage/v1/object/public/actor-assets/…/still-b-16x9.jpg"
  ],
  "turnaround_url": "https://example.supabase.co/storage/v1/object/public/actor-assets/…/turnaround-16x9.png",
  "tags": ["Memphis", "Lead", "Gritty"],
  "notes": "Production lock v1 — do not drift wardrobe for Episodes 3–5."
}`;

export default async function DevelopersPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/admin-access?reason=sign-in");
  }
  const isAdmin = await getIsAdmin();
  if (!isAdmin) {
    redirect("/admin-access");
  }

  return (
    <div className="min-h-full bg-cinematic-black text-foreground">
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-10 md:pt-14">
        <nav className="mb-8">
          <Link
            href="/"
            className="text-sm text-metallic-orange transition hover:brightness-110"
          >
            ← Back to gallery
          </Link>
        </nav>

        <h1
          className="mb-3 text-3xl font-bold tracking-tight text-metallic-orange md:text-4xl"
          style={{
            fontFamily: "var(--font-display), ui-sans-serif, system-ui, sans-serif",
          }}
        >
          Developers &amp; schema
        </h1>
        <p className="mb-10 max-w-2xl text-sm leading-relaxed text-white/65">
          This site is both a <strong className="text-white/85">visual gallery</strong> and a{" "}
          <strong className="text-white/85">documentation hub</strong>. External tools should treat
          Supabase <code className="text-white/70">public.actors</code> rows as the source of truth.
          Canonical Field IDs live in{" "}
          <code className="rounded-sm bg-white/10 px-1.5 py-0.5 text-white/80">
            actor_onboarding_spec.md
          </code>{" "}
          at the repo root.
        </p>

        <section className="mb-12 rounded-sm border border-metallic-orange/35 bg-metallic-orange/10 p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-metallic-orange">
            Partner HTTP API
          </h2>
          <p className="mb-3 text-sm leading-relaxed text-white/70">
            Licensed studios can integrate with <strong className="text-white/85">catalog + per-character
            export</strong> (LoRA URL, trigger, headshots, turnaround, voice id, style fields) using{" "}
            <code className="text-white/75">CHARACTER_PACK_API_KEYS</code> — same key for list and detail.
          </p>
          <p className="text-sm text-white/65">
            OpenAPI 3 (import into Postman / codegen):{" "}
            <a
              href="/api/v1/openapi"
              className="font-mono text-[13px] text-metallic-orange underline underline-offset-2 hover:brightness-110"
            >
              GET /api/v1/openapi
            </a>
            {" · "}
            List:{" "}
            <code className="text-white/60">GET /api/v1/characters</code>
            {" · "}
            Pack:{" "}
            <code className="text-white/60">GET /api/v1/characters/{"{id}"}</code>
          </p>
          <p className="mt-3 text-sm text-white/60">
            <strong className="text-white/75">Push notifications:</strong> register an HTTPS URL (per API key)
            via <code className="text-white/70">POST /api/admin/partner-pack-webhooks</code> with the same key
            and a signing secret returned by the server; events include{" "}
            <code className="text-white/70">character.created</code>,{" "}
            <code className="text-white/70">character.pack_updated</code>,{" "}
            <code className="text-white/70">character.deleted</code>.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-metallic-orange">
            External name aliases
          </h2>
          <p className="mb-4 text-sm text-white/60">
            Some docs say <code className="text-white/75">face_dna</code>,{" "}
            <code className="text-white/75">locked_uniform</code>, or{" "}
            <code className="text-white/75">visual_tone</code>. In this database they map to:
          </p>
          <ul className="list-inside list-disc space-y-2 text-sm text-white/70">
            <li>
              <code className="text-metallic-orange/90">physical_description</code> — Face DNA
              (Field 2.0)
            </li>
            <li>
              <code className="text-metallic-orange/90">fashion_style</code> — Locked uniform (Field
              3.0); <code className="text-white/60">signature_style</code> may still carry legacy
              look notes
            </li>
            <li>
              <code className="text-metallic-orange/90">mood_keywords</code> — Visual tone (Field 4.0)
            </li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-metallic-orange">
            Field reference (summary)
          </h2>
          <div className="overflow-x-auto rounded-sm border border-white/10">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs text-white/80">
              <thead>
                <tr className="border-b border-white/15 bg-black/50 text-[10px] uppercase tracking-wider text-metallic-orange/90">
                  <th className="p-3 font-semibold">ID</th>
                  <th className="p-3 font-semibold">Column</th>
                  <th className="p-3 font-semibold">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {[
                  ["1.0", "name", "Core identity"],
                  ["1.1", "age (+ age_range*)", "Age / playing band"],
                  ["1.2", "ethnicity", "Heritage (import 6.txt / 7.txt)"],
                  ["1.3", "sex", "Casting"],
                  ["1.4", "origin_city", "Region"],
                  ["2.0", "physical_description", "Face DNA"],
                  ["2.1", "must_keep_identity_traits", "Identity lock"],
                  ["1.5–1.9", "personality_archetype … market_segment", "Narrative bible"],
                  ["1.7", "backstory_summary", "Biography text (no separate biography column)"],
                  ["3.0", "fashion_style", "Locked uniform"],
                  ["4.0", "mood_keywords", "Visual tone"],
                  ["5.0", "headshot_urls[0]", "Master hero 9:16 (gallery + identity)"],
                  ["5.0a", "headshot_urls[1–2]", "16:9 stills (pair with [0])"],
                  ["5.1", "turnaround_url", "16:9 horizontal turnaround sheet"],
                  ["6.0", "tags", "Search keywords (text[])"],
                  ["6.1", "pack_name", "Demographic pack label"],
                  ["7.0", "notes", "Production notes"],
                ].map(([id, col, role]) => (
                  <tr key={String(id)} className="bg-black/25 hover:bg-black/40">
                    <td className="p-3 font-mono text-metallic-orange/85">{id}</td>
                    <td className="p-3 font-mono text-white/75">{col}</td>
                    <td className="p-3 text-white/60">{role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-white/45">
            *See <code className="text-white/55">actor_onboarding_spec.md</code> for full Field IDs
            1.10–1.14, legacy headshot columns, and migration filenames.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-metallic-orange">
            Sample JSON (illustrative)
          </h2>
          <p className="mb-3 text-sm text-white/55">
            Representative payload for a lead like <strong className="text-white/80">Marcus King</strong>
            — URLs are placeholders; your project stores real Supabase Storage URLs. Minimum production pack:{" "}
            <strong className="text-white/75">four</strong> assets —{" "}
            <code className="text-white/60">headshot_urls[0]</code>{" "}
            <span className="text-white/50">9:16</span>,{" "}
            <code className="text-white/60">[1]</code> and <code className="text-white/60">[2]</code>{" "}
            <span className="text-white/50">16:9</span> stills, plus{" "}
            <code className="text-white/60">turnaround_url</code>{" "}
            <span className="text-white/50">16:9</span>.
          </p>
          <pre className="max-h-[min(70vh,520px)] overflow-auto rounded-sm border border-white/10 bg-black/55 p-4 text-left text-[11px] leading-relaxed text-white/75">
            {SAMPLE_ACTOR_JSON}
          </pre>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-metallic-orange">
            Bulk import from disk (one folder per actor)
          </h2>
          <p className="mb-3 text-sm text-white/65">
            Layout is <strong className="text-white/80">one actor = one folder</strong> under a pack
            (e.g. <code className="text-white/75">PackName/actor-slug/1.txt</code>) so libraries stay easy
            to admin, diff, and re-zip per character. Postgres cannot read your laptop folders. In the
            app: <strong className="text-white/80">Admin → Import zip / folder</strong> (
            <code className="text-white/70">/admin/import-actors</code>) parses the same numbered{" "}
            <code className="text-white/75">1.txt</code>–<code className="text-white/75">33.txt</code>{" "}
            layout in the browser, uploads optional images, and writes to Supabase (
            <code className="text-white/70">POST /api/admin/actor-library-import</code>). From the CLI:{" "}
            <code className="rounded-sm bg-white/10 px-1.5 py-0.5 text-white/80">
              {`npm run import:actors -- --root "/absolute/path/to/library"`}
            </code>
            . Mapping:{" "}
            <code className="text-white/70">scripts/actor-folder-import/README.md</code>,{" "}
            <code className="text-white/70">lib/actor-import-field-map.json</code>.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-metallic-orange">
            HTTP surface (today)
          </h2>
          <ul className="space-y-2 text-sm text-white/65">
            <li>
              <code className="text-white/75">POST /api/admin/actor-library-import</code> — admin
              multipart: manifest JSON + optional image parts per actor (used by import UI and actor
              pipeline). Field <code className="text-white/55">29.txt</code> is an optional (recommended)
              suggested ElevenLabs voice id; admins approve via{" "}
              <code className="text-white/55">/admin/voice-review</code> or backfill in casting.
            </li>
            <li>
              <code className="text-white/75">POST /api/actors/[id]/download-assets</code> — zip of
              selected headshots ± turnaround (signed-in; see route implementation).
            </li>
            <li>
              <code className="text-white/75">GET /api/actors/[id]/taxonomy</code> — linked taxonomy
              terms when enabled.
            </li>
          </ul>
          <p className="mt-4 text-xs text-white/45">
            A dedicated public read API (e.g. <code className="text-white/55">GET /api/v1/actors/:id</code>
            ) can be added for ComfyUI nodes; until then, use server-side Supabase service role or
            expose read-only views with RLS.
          </p>
        </section>
      </main>
    </div>
  );
}
