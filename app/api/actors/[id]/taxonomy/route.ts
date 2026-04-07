import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  isTaxonomyCategory,
  TAXONOMY_CATEGORY_ORDER,
  TAXONOMY_CATEGORY_LABELS,
} from "@/lib/constants/taxonomy-categories";
import { createSupabaseServiceRoleClient } from "@/lib/supabase";

const LABEL_MAX = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: actorId } = await ctx.params;
  if (!actorId) {
    return NextResponse.json({ error: "Missing actor id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const category =
    typeof body === "object" &&
    body !== null &&
    "category" in body &&
    typeof (body as { category: unknown }).category === "string"
      ? (body as { category: string }).category.trim()
      : "";
  const labelRaw =
    typeof body === "object" &&
    body !== null &&
    "label" in body &&
    typeof (body as { label: unknown }).label === "string"
      ? (body as { label: string }).label.trim()
      : "";
  const label = labelRaw.slice(0, LABEL_MAX);

  if (!category || !label) {
    return NextResponse.json(
      { error: "Provide non-empty category and label" },
      { status: 400 },
    );
  }

  if (!isTaxonomyCategory(category)) {
    return NextResponse.json(
      {
        error: "Invalid category",
        allowed: TAXONOMY_CATEGORY_ORDER.map((k) => ({
          key: k,
          label: TAXONOMY_CATEGORY_LABELS[k],
        })),
      },
      { status: 400 },
    );
  }

  let supabase;
  try {
    supabase = createSupabaseServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const { data: actor, error: actorErr } = await supabase
    .from("actors")
    .select("id")
    .eq("id", actorId)
    .maybeSingle();

  if (actorErr || !actor) {
    return NextResponse.json(
      { error: "Actor not found" },
      { status: 404 },
    );
  }

  const { data: existing } = await supabase
    .from("taxonomy_terms")
    .select("id")
    .eq("category", category)
    .eq("label", label)
    .maybeSingle();

  let termId = existing?.id as string | undefined;

  if (!termId) {
    const { data: inserted, error: insErr } = await supabase
      .from("taxonomy_terms")
      .insert({ category, label })
      .select("id")
      .single();

    if (!insErr && inserted?.id) {
      termId = inserted.id as string;
    } else {
      const { data: concurrent } = await supabase
        .from("taxonomy_terms")
        .select("id")
        .eq("category", category)
        .eq("label", label)
        .maybeSingle();
      termId = concurrent?.id as string | undefined;
    }
  }

  if (!termId) {
    return NextResponse.json(
      { error: "Could not create or resolve taxonomy term" },
      { status: 500 },
    );
  }

  const { error: linkErr } = await supabase.from("actor_taxonomy").insert({
    actor_id: actorId,
    term_id: termId,
  });

  if (linkErr) {
    if (linkErr.code === "23505") {
      return NextResponse.json({
        ok: true,
        termId,
        alreadyLinked: true,
      });
    }
    return NextResponse.json(
      { error: linkErr.message ?? "Could not link term to actor" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, termId, alreadyLinked: false });
}
