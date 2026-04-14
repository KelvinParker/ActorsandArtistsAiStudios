import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import { ageRangeTextFromRow } from "@/lib/playing-age";
import type { ActorRow, TaxonomyTerm } from "@/lib/types/actor";

function isMissingColumnError(message: string): boolean {
  return /\bcolumn\s+[\w.]+\s+does\s+not\s+exist\b/i.test(message);
}

function parseEmbeddedTerm(raw: unknown): TaxonomyTerm | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    typeof o.category !== "string" ||
    typeof o.label !== "string"
  ) {
    return null;
  }
  return { id: o.id, category: o.category, label: o.label };
}

async function attachTaxonomyIfAvailable(
  supabase: SupabaseClient,
  actors: ActorRow[],
): Promise<ActorRow[]> {
  if (actors.length === 0) return actors;

  const { data, error } = await supabase
    .from("actor_taxonomy")
    .select("actor_id, taxonomy_terms ( id, category, label )")
    .in(
      "actor_id",
      actors.map((a) => a.id),
    );

  if (error) {
    return actors.map((a) => ({ ...a, taxonomy: [] }));
  }

  const map = new Map<string, TaxonomyTerm[]>();
  for (const row of data ?? []) {
    const r = row as { actor_id: string; taxonomy_terms: unknown };
    const raw = r.taxonomy_terms;
    const term = Array.isArray(raw)
      ? parseEmbeddedTerm(raw[0])
      : parseEmbeddedTerm(raw);
    if (!term) continue;
    const list = map.get(r.actor_id) ?? [];
    list.push(term);
    map.set(r.actor_id, list);
  }

  return actors.map((a) => ({
    ...a,
    taxonomy: map.get(a.id) ?? [],
  }));
}

/**
 * Batched fetch of profile / casting stats by column name. Merges over partial
 * gallery selects so sex, height, weight, age_range, etc. stay correct regardless
 * of physical column order in Postgres.
 */
async function attachProfileCastingFieldsIfAvailable(
  supabase: SupabaseClient,
  actors: ActorRow[],
): Promise<ActorRow[]> {
  if (actors.length === 0) return actors;
  const ids = actors.map((a) => a.id);

  const profileSelectAttempts: string[] = [
    "id,ethnicity,sex,height,weight,age_range,age_range_min,age_range_max",
    "id,sex,height,weight,age_range,age_range_min,age_range_max",
    "id,sex,height,weight,age_range",
    "id,sex,height,weight",
  ];

  for (const cols of profileSelectAttempts) {
    const { data, error } = await supabase
      .from("actors")
      .select(cols as never)
      .in("id", ids);

    if (error) {
      if (!isMissingColumnError(error.message)) {
        return actors;
      }
      continue;
    }

    const map = new Map<string, Record<string, unknown>>();
    for (const row of data ?? []) {
      const r = row as unknown as Record<string, unknown>;
      const id = r.id;
      if (typeof id === "string") map.set(id, r);
    }

    return actors.map((a) => {
      const patch = map.get(a.id);
      if (!patch) return a;
      const { id: _drop, ...rest } = patch;
      const merged = { ...a, ...rest } as ActorRow;
      // Follow-up select sometimes returns age_range: null; spreading would wipe the
      // value from select('*'). Prefer existing text when the patch adds nothing.
      const patchText = ageRangeTextFromRow(rest.age_range);
      const priorText = ageRangeTextFromRow(a.age_range);
      if (!patchText && priorText) {
        return { ...merged, age_range: a.age_range } as ActorRow;
      }
      return merged;
    });
  }

  return actors;
}

async function attachPhysicalDescriptionIfAvailable(
  supabase: SupabaseClient,
  actors: ActorRow[],
): Promise<ActorRow[]> {
  if (actors.length === 0) return actors;
  const ids = actors.map((a) => a.id);

  const { data, error } = await supabase
    .from("actors")
    .select("id,physical_description")
    .in("id", ids);

  if (error) {
    if (isMissingColumnError(error.message)) {
      return actors;
    }
    return actors;
  }

  const map = new Map<string, string | null>();
  for (const row of data ?? []) {
    const r = row as { id: string; physical_description: unknown };
    const v = r.physical_description;
    map.set(r.id, typeof v === "string" ? v : null);
  }

  return actors.map((a) => ({
    ...a,
    physical_description: map.get(a.id) ?? a.physical_description ?? null,
  }));
}

async function attachDnaLoraFieldsIfAvailable(
  supabase: SupabaseClient,
  actors: ActorRow[],
): Promise<ActorRow[]> {
  if (actors.length === 0) return actors;
  const ids = actors.map((a) => a.id);

  const { data, error } = await supabase
    .from("actors")
    .select(
      "id,dna_lora_url,dna_lora_trigger,dna_1_url,dna_2_url,dna_3_url,dna_4_url,dna_5_url,dna_6_url,dna_lora_training_urls,dna_lora_fal_request_id,dna_lora_status,dna_lora_error,dna_lora_completed_at",
    )
    .in("id", ids);

  if (error) {
    if (isMissingColumnError(error.message)) {
      return actors;
    }
    return actors;
  }

  type LoraCols = {
    dna_lora_url: string | null;
    dna_lora_trigger: string | null;
    dna_1_url: string | null;
    dna_2_url: string | null;
    dna_3_url: string | null;
    dna_4_url: string | null;
    dna_5_url: string | null;
    dna_6_url: string | null;
    dna_lora_training_urls: string[] | null;
    dna_lora_fal_request_id: string | null;
    dna_lora_status: string | null;
    dna_lora_error: string | null;
    dna_lora_completed_at: string | null;
  };
  const map = new Map<string, LoraCols>();
  for (const row of data ?? []) {
    const r = row as { id: string } & Record<string, unknown>;
    map.set(r.id, {
      dna_lora_url: typeof r.dna_lora_url === "string" ? r.dna_lora_url : null,
      dna_lora_trigger: typeof r.dna_lora_trigger === "string" ? r.dna_lora_trigger : null,
      dna_1_url: typeof r.dna_1_url === "string" ? r.dna_1_url : null,
      dna_2_url: typeof r.dna_2_url === "string" ? r.dna_2_url : null,
      dna_3_url: typeof r.dna_3_url === "string" ? r.dna_3_url : null,
      dna_4_url: typeof r.dna_4_url === "string" ? r.dna_4_url : null,
      dna_5_url: typeof r.dna_5_url === "string" ? r.dna_5_url : null,
      dna_6_url: typeof r.dna_6_url === "string" ? r.dna_6_url : null,
      dna_lora_training_urls: Array.isArray(r.dna_lora_training_urls)
        ? (r.dna_lora_training_urls as unknown[]).filter(
            (x): x is string => typeof x === "string" && x.trim().length > 0,
          )
        : null,
      dna_lora_fal_request_id:
        typeof r.dna_lora_fal_request_id === "string" ? r.dna_lora_fal_request_id : null,
      dna_lora_status: typeof r.dna_lora_status === "string" ? r.dna_lora_status : null,
      dna_lora_error: typeof r.dna_lora_error === "string" ? r.dna_lora_error : null,
      dna_lora_completed_at:
        typeof r.dna_lora_completed_at === "string" ? r.dna_lora_completed_at : null,
    });
  }

  return actors.map((a) => {
    const c = map.get(a.id);
    if (!c) return a;
    return {
      ...a,
      dna_lora_url: c.dna_lora_url ?? a.dna_lora_url ?? null,
      dna_lora_trigger: c.dna_lora_trigger ?? a.dna_lora_trigger ?? null,
      dna_1_url: c.dna_1_url ?? a.dna_1_url ?? null,
      dna_2_url: c.dna_2_url ?? a.dna_2_url ?? null,
      dna_3_url: c.dna_3_url ?? a.dna_3_url ?? null,
      dna_4_url: c.dna_4_url ?? a.dna_4_url ?? null,
      dna_5_url: c.dna_5_url ?? a.dna_5_url ?? null,
      dna_6_url: c.dna_6_url ?? a.dna_6_url ?? null,
      dna_lora_training_urls: c.dna_lora_training_urls ?? a.dna_lora_training_urls ?? null,
      dna_lora_fal_request_id: c.dna_lora_fal_request_id ?? a.dna_lora_fal_request_id ?? null,
      dna_lora_status: c.dna_lora_status ?? a.dna_lora_status ?? null,
      dna_lora_error: c.dna_lora_error ?? a.dna_lora_error ?? null,
      dna_lora_completed_at: c.dna_lora_completed_at ?? a.dna_lora_completed_at ?? null,
    };
  });
}

async function attachPackNameNotesIfAvailable(
  supabase: SupabaseClient,
  actors: ActorRow[],
): Promise<ActorRow[]> {
  if (actors.length === 0) return actors;
  const ids = actors.map((a) => a.id);

  const { data, error } = await supabase
    .from("actors")
    .select("id,pack_name,notes")
    .in("id", ids);

  if (error) {
    if (isMissingColumnError(error.message)) {
      return actors;
    }
    return actors;
  }

  const packMap = new Map<string, string | null>();
  const notesMap = new Map<string, string | null>();
  for (const row of data ?? []) {
    const r = row as { id: string; pack_name: unknown; notes: unknown };
    packMap.set(r.id, typeof r.pack_name === "string" ? r.pack_name : null);
    notesMap.set(r.id, typeof r.notes === "string" ? r.notes : null);
  }

  return actors.map((a) => ({
    ...a,
    pack_name: packMap.get(a.id) ?? a.pack_name ?? null,
    notes: notesMap.get(a.id) ?? a.notes ?? null,
  }));
}

async function attachFashionMoodKeywordsIfAvailable(
  supabase: SupabaseClient,
  actors: ActorRow[],
): Promise<ActorRow[]> {
  if (actors.length === 0) return actors;
  const ids = actors.map((a) => a.id);

  const { data, error } = await supabase
    .from("actors")
    .select("id,fashion_style,mood_keywords")
    .in("id", ids);

  if (error) {
    if (isMissingColumnError(error.message)) {
      return actors;
    }
    return actors;
  }

  const fashionMap = new Map<string, string | null>();
  const moodMap = new Map<string, string | null>();
  for (const row of data ?? []) {
    const r = row as { id: string; fashion_style: unknown; mood_keywords: unknown };
    fashionMap.set(r.id, typeof r.fashion_style === "string" ? r.fashion_style : null);
    moodMap.set(r.id, typeof r.mood_keywords === "string" ? r.mood_keywords : null);
  }

  return actors.map((a) => ({
    ...a,
    fashion_style: fashionMap.get(a.id) ?? a.fashion_style ?? null,
    mood_keywords: moodMap.get(a.id) ?? a.mood_keywords ?? null,
  }));
}

async function attachHeadshotUrlsIfAvailable(
  supabase: SupabaseClient,
  actors: ActorRow[],
): Promise<ActorRow[]> {
  if (actors.length === 0) return actors;

  const { data, error } = await supabase
    .from("actors")
    .select("id, headshot_urls")
    .in("id", actors.map((a) => a.id));

  if (error) {
    return actors.map((a) => ({ ...a, headshot_urls: undefined }));
  }

  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const r = row as { id: string; headshot_urls: unknown };
    const raw = r.headshot_urls;
    const list = Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === "string")
      : [];
    map.set(r.id, list);
  }

  return actors.map((a) => ({
    ...a,
    headshot_urls: map.get(a.id) ?? a.headshot_urls ?? [],
  }));
}

async function attachElevenlabsVoiceReviewIfAvailable(
  supabase: SupabaseClient,
  actors: ActorRow[],
): Promise<ActorRow[]> {
  if (actors.length === 0) return actors;
  const ids = actors.map((a) => a.id);

  const { data, error } = await supabase
    .from("actors")
    .select("id,elevenlabs_voice_suggested_id,elevenlabs_voice_approved_at")
    .in("id", ids);

  if (error) {
    if (isMissingColumnError(error.message)) {
      return actors;
    }
    return actors;
  }

  const map = new Map<
    string,
    { elevenlabs_voice_suggested_id: string | null; elevenlabs_voice_approved_at: string | null }
  >();
  for (const row of data ?? []) {
    const r = row as {
      id: string;
      elevenlabs_voice_suggested_id: unknown;
      elevenlabs_voice_approved_at: unknown;
    };
    map.set(r.id, {
      elevenlabs_voice_suggested_id:
        typeof r.elevenlabs_voice_suggested_id === "string" ? r.elevenlabs_voice_suggested_id : null,
      elevenlabs_voice_approved_at:
        typeof r.elevenlabs_voice_approved_at === "string" ? r.elevenlabs_voice_approved_at : null,
    });
  }

  return actors.map((a) => {
    const p = map.get(a.id);
    if (!p) return a;
    return { ...a, ...p };
  });
}

/** Explicit headshot columns + legacy `headshot_urls`; fall back if migration not applied. */
const HSX =
  "headshot_2_url,headshot_3_url,headshot_4_url,headshot_5_url";
const DEPTH =
  "origin_city,backstory_summary,primary_goal,core_wound,fatal_flaw,signature_style,market_segment,must_keep_identity_traits,stage_name,vocal_range,personality_archetype,created_by_user_id,is_user_generated,visibility,generation_quality_mode";

/** `age_range` text + numeric band; min/max only; text-only; or neither (older DBs). */
const AGE_COLS_FULL = "age_range,age_range_min,age_range_max";
const AGE_COLS_MINMAX = "age_range_min,age_range_max";
/** Table Editor often sets only this; must be selected before the empty fragment. */
const AGE_COLS_TEXT_ONLY = "age_range";

/**
 * @param includeLegacyAgeColumn include `age` when the table still has that column;
 *        omit it after the column is dropped (only `age_range` remains).
 */
function selectListsWithAgeCols(
  ageCols: string,
  includeLegacyAgeColumn: boolean,
): readonly string[] {
  const mid = includeLegacyAgeColumn
    ? ageCols
      ? `,age,${ageCols}`
      : `,age`
    : ageCols
      ? `,${ageCols}`
      : ``;
  return [
    `id,gallery_sort_order,name,${DEPTH}${mid},tags,headshot_url,${HSX},headshot_urls,turnaround_url,ethnicity,traits,speech,levellabs_speech_id,height,weight,search_keywords,sex`,
    `id,gallery_sort_order,name,${DEPTH}${mid},tags,headshot_url,${HSX},headshot_urls,turnaround_url,ethnicity,traits,speech,levellabs_speech_id,height,weight,search_keywords`,
    `id,gallery_sort_order,name,${DEPTH}${mid},tags,headshot_url,${HSX},headshot_urls,turnaround_url,ethnicity,traits,speech,levellabs_speech_id`,
    `id,gallery_sort_order,name,${DEPTH}${mid},tags,headshot_url,${HSX},headshot_urls,turnaround_url`,
    `id,gallery_sort_order,name,${DEPTH}${mid},tags,headshot_urls,${HSX},turnaround_url,ethnicity,traits,speech,levellabs_speech_id,height,weight,search_keywords,sex`,
    `id,gallery_sort_order,name,${DEPTH}${mid},tags,headshot_urls,${HSX},turnaround_url,ethnicity,traits,speech,levellabs_speech_id,height,weight,search_keywords`,
    `id,gallery_sort_order,name,${DEPTH}${mid},tags,headshot_urls,${HSX},turnaround_url,ethnicity,traits,speech,levellabs_speech_id`,
    `id,gallery_sort_order,name,${DEPTH}${mid},tags,headshot_urls,${HSX},turnaround_url`,
    `id,gallery_sort_order,name,${DEPTH}${mid},tags,headshot_url,turnaround_url,ethnicity,traits,speech,levellabs_speech_id,height,weight,search_keywords,sex`,
    `id,gallery_sort_order,name,${DEPTH}${mid},tags,headshot_url,turnaround_url,ethnicity,traits,speech,levellabs_speech_id,height,weight,search_keywords`,
    `id,gallery_sort_order,name,${DEPTH}${mid},tags,headshot_url,turnaround_url,ethnicity,traits,speech,levellabs_speech_id`,
    `id,gallery_sort_order,name${mid},tags,headshot_url,turnaround_url`,
    `id,gallery_sort_order,name,${DEPTH}${mid},tags,headshot_urls,turnaround_url,ethnicity,traits,speech,levellabs_speech_id,height,weight,search_keywords,sex`,
    `id,gallery_sort_order,name,${DEPTH}${mid},tags,headshot_urls,turnaround_url,ethnicity,traits,speech,levellabs_speech_id,height,weight,search_keywords`,
    `id,gallery_sort_order,name,${DEPTH}${mid},tags,headshot_urls,turnaround_url,ethnicity,traits,speech,levellabs_speech_id`,
    `id,gallery_sort_order,name${mid},tags,headshot_urls,turnaround_url`,
  ];
}

/** DBs that have not applied `levellabs_speech_id` migration yet. */
function withoutLevellabsColumn(selectList: string): string {
  return selectList.replace(/,levellabs_speech_id/g, "");
}

/** DBs that have not applied `gallery_sort_order` migration yet. */
function withoutGallerySortOrderColumn(selectList: string): string {
  return selectList.replace(/gallery_sort_order,/g, "");
}

function gallerySortKey(row: ActorRow): number {
  const v = row.gallery_sort_order as unknown;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return 100000;
}

/** Stable home-gallery order: `gallery_sort_order` asc, then name. */
export function sortActorsForGallery(actors: ActorRow[]): ActorRow[] {
  return [...actors].sort((a, b) => {
    const ao = gallerySortKey(a);
    const bo = gallerySortKey(b);
    if (ao !== bo) return ao - bo;
    return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
  });
}

const SELECT_LIST_BASE: readonly string[] = [
  ...selectListsWithAgeCols(AGE_COLS_FULL, true),
  ...selectListsWithAgeCols(AGE_COLS_MINMAX, true),
  ...selectListsWithAgeCols(AGE_COLS_TEXT_ONLY, true),
  ...selectListsWithAgeCols("", true),
  ...selectListsWithAgeCols(AGE_COLS_FULL, false),
  ...selectListsWithAgeCols(AGE_COLS_MINMAX, false),
  ...selectListsWithAgeCols(AGE_COLS_TEXT_ONLY, false),
  ...selectListsWithAgeCols("", false),
];

const SELECT_ATTEMPTS: readonly string[] = [
  "*",
  ...SELECT_LIST_BASE,
  ...SELECT_LIST_BASE.map(withoutLevellabsColumn),
  ...SELECT_LIST_BASE.map(withoutGallerySortOrderColumn),
  ...SELECT_LIST_BASE.map((s) =>
    withoutLevellabsColumn(withoutGallerySortOrderColumn(s)),
  ),
];

/**
 * Loads actors for the home gallery. Tries progressively narrower column lists,
 * then the same with `headshot_urls` instead of `headshot_url` if the primary
 * column was removed. Retries without `age_range` text, then without numeric
 * `age_range_*`, then `age_range` text only (no min/max columns), then without
 * legacy `age` if that column was dropped. `*` is first (column order in the
 * table does not affect JSON keys). Profile fields are always merged in a
 * second query so `age_range`, sex, height, and weight stay populated.
 */
export async function fetchActorsForGallery(supabase: SupabaseClient): Promise<{
  actors: ActorRow[];
  error: PostgrestError | null;
}> {
  let lastError: PostgrestError | null = null;

  for (const selectList of SELECT_ATTEMPTS) {
    const { data, error } = await supabase
      .from("actors")
      .select(selectList)
      .order("name", { ascending: true });

    if (!error) {
      let base = (data ?? []) as unknown as ActorRow[];
      base = await attachProfileCastingFieldsIfAvailable(supabase, base);
      base = await attachPhysicalDescriptionIfAvailable(supabase, base);
      base = await attachPackNameNotesIfAvailable(supabase, base);
      base = await attachDnaLoraFieldsIfAvailable(supabase, base);
      base = await attachFashionMoodKeywordsIfAvailable(supabase, base);
      base = await attachElevenlabsVoiceReviewIfAvailable(supabase, base);
      const withTax = await attachTaxonomyIfAvailable(supabase, base);
      const withUrls = await attachHeadshotUrlsIfAvailable(supabase, withTax);
      const actors = sortActorsForGallery(withUrls);
      return { actors, error: null };
    }

    lastError = error;
    if (!isMissingColumnError(error.message)) {
      return { actors: [], error };
    }
  }

  return { actors: [], error: lastError };
}

/**
 * Single actor for `/actors/[id]` (same column attempts as the gallery list).
 */
export async function fetchActorById(
  supabase: SupabaseClient,
  id: string,
): Promise<{ actor: ActorRow | null; error: PostgrestError | null }> {
  let lastError: PostgrestError | null = null;

  for (const selectList of SELECT_ATTEMPTS) {
    const { data, error } = await supabase
      .from("actors")
      .select(selectList)
      .eq("id", id)
      .maybeSingle();

    if (!error) {
      if (!data) {
        return { actor: null, error: null };
      }
      let base = [data as unknown as ActorRow];
      base = await attachProfileCastingFieldsIfAvailable(supabase, base);
      base = await attachPhysicalDescriptionIfAvailable(supabase, base);
      base = await attachPackNameNotesIfAvailable(supabase, base);
      base = await attachDnaLoraFieldsIfAvailable(supabase, base);
      base = await attachFashionMoodKeywordsIfAvailable(supabase, base);
      base = await attachElevenlabsVoiceReviewIfAvailable(supabase, base);
      const withTax = await attachTaxonomyIfAvailable(supabase, base);
      const withUrls = await attachHeadshotUrlsIfAvailable(supabase, withTax);
      return { actor: withUrls[0] ?? null, error: null };
    }

    lastError = error;
    if (!isMissingColumnError(error.message)) {
      return { actor: null, error };
    }
  }

  return { actor: null, error: lastError };
}

/**
 * Other gallery characters ranked by shared taxonomy terms and tags, then filler
 * from the rest of the roster (same fetch path as the home gallery).
 */
export async function fetchSimilarActors(
  supabase: SupabaseClient,
  current: ActorRow,
  limit = 6,
): Promise<ActorRow[]> {
  const { actors, error } = await fetchActorsForGallery(supabase);
  if (error || actors.length <= 1) return [];

  const others = actors.filter((a) => a.id !== current.id);
  if (others.length === 0) return [];

  const termIds = new Set((current.taxonomy ?? []).map((t) => t.id));
  const tagSet = new Set(
    (current.tags ?? [])
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  );
  const heritageKey = (current.ethnicity?.trim() || "").toLowerCase() || "";

  function score(a: ActorRow): number {
    let s = 0;
    for (const t of a.taxonomy ?? []) {
      if (termIds.has(t.id)) s += 2;
    }
    for (const tag of a.tags ?? []) {
      if (tagSet.has(tag.trim().toLowerCase())) s += 1;
    }
    const h2 = (a.ethnicity?.trim() || "").toLowerCase() || "";
    if (heritageKey && h2 && heritageKey === h2) s += 1;
    return s;
  }

  const scored = others.map((a) => ({ a, sc: score(a) }));
  scored.sort((x, y) => {
    if (y.sc !== x.sc) return y.sc - x.sc;
    return x.a.name.localeCompare(y.a.name);
  });

  const picked = scored.slice(0, limit).map((x) => x.a);
  return picked;
}
