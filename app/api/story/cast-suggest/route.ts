import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { ActorRow } from "@/lib/types/actor";
import { fetchActorsForGallery } from "@/lib/actors-query";
import { createSupabaseServiceRoleClient } from "@/lib/supabase";

type CharacterSpec = {
  name: string;
  roleArchetype?: string;
  ageRange?: string;
  moodTone?: string;
  visualStyle?: string;
  mustKeepTraits?: string;
  tags?: string[];
};

function parseBody(body: unknown): CharacterSpec[] {
  if (!body || typeof body !== "object") return [];
  if (!("characters" in body)) return [];
  const list = (body as { characters?: unknown }).characters;
  if (!Array.isArray(list)) return [];
  const mapped: Array<CharacterSpec | null> = list
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const name = String(r.name ?? "").trim();
      if (!name) return null;
      const tags = Array.isArray(r.tags)
        ? r.tags.map((v) => String(v ?? "").trim()).filter(Boolean)
        : [];
      return {
        name,
        roleArchetype: String(r.roleArchetype ?? "").trim() || undefined,
        ageRange: String(r.ageRange ?? "").trim() || undefined,
        moodTone: String(r.moodTone ?? "").trim() || undefined,
        visualStyle: String(r.visualStyle ?? "").trim() || undefined,
        mustKeepTraits: String(r.mustKeepTraits ?? "").trim() || undefined,
        tags,
      } satisfies CharacterSpec;
    });
  return mapped.filter((v): v is CharacterSpec => v !== null);
}

function tokenize(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .map((t) => t.trim())
      .filter((t) => t.length > 2),
  );
}

function scoreActorForCharacter(actor: ActorRow, character: CharacterSpec): { score: number; rationale: string[] } {
  const rationale: string[] = [];
  let score = 0;

  const actorTags = new Set((actor.tags ?? []).map((t) => t.toLowerCase()));
  const requestedTags = new Set((character.tags ?? []).map((t) => t.toLowerCase()));
  const overlapTags = [...requestedTags].filter((t) => actorTags.has(t));
  if (overlapTags.length) {
    score += overlapTags.length * 15;
    rationale.push(`Tag overlap: ${overlapTags.join(", ")}`);
  }

  const actorTraits = tokenize((actor.traits ?? []).join(" "));
  const actorSpeech = tokenize(actor.speech ?? "");
  const actorKeywords = tokenize((actor.search_keywords ?? []).join(" "));
  const actorText = new Set([...actorTraits, ...actorSpeech, ...actorKeywords]);

  const intentText = [
    character.roleArchetype,
    character.moodTone,
    character.visualStyle,
    character.mustKeepTraits,
  ]
    .filter(Boolean)
    .join(" ");
  const intentTokens = tokenize(intentText);
  const tokenOverlap = [...intentTokens].filter((t) => actorText.has(t));
  if (tokenOverlap.length) {
    score += Math.min(30, tokenOverlap.length * 4);
    rationale.push(`Trait/tone overlap: ${tokenOverlap.slice(0, 6).join(", ")}`);
  }

  if (character.ageRange && actor.age_range && character.ageRange === actor.age_range) {
    score += 12;
    rationale.push("Exact age range match");
  }

  if (actor.stage_name?.trim()) {
    score += 2;
    rationale.push("Has stage identity");
  }

  if (actor.headshot_url || (actor.headshot_urls?.length ?? 0) > 0) {
    score += 6;
    rationale.push("Has visual assets");
  }

  return { score, rationale };
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const characters = parseBody(body);
  if (characters.length === 0) {
    return NextResponse.json({ error: "Provide characters[]" }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { actors, error } = await fetchActorsForGallery(supabase);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const suggestions = characters.map((character) => {
    const ranked = actors
      .map((actor) => {
        const { score, rationale } = scoreActorForCharacter(actor, character);
        return {
          actorId: actor.id,
          actorName: actor.name,
          score,
          rationale,
          tags: actor.tags ?? [],
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      character,
      matches: ranked,
    };
  });

  return NextResponse.json({ ok: true, suggestions });
}
