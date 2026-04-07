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
    "id,race,sex,height,weight,age_range,age_range_min,age_range_max",
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

/** Explicit headshot columns + legacy `headshot_urls`; fall back if migration not applied. */
const HSX =
  "headshot_2_url,headshot_3_url,headshot_4_url,headshot_5_url";

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
    `id,name${mid},tags,headshot_url,${HSX},headshot_urls,turnaround_url,race,traits,speech,levellabs_speech_id,height,weight,search_keywords,sex`,
    `id,name${mid},tags,headshot_url,${HSX},headshot_urls,turnaround_url,race,traits,speech,levellabs_speech_id,height,weight,search_keywords`,
    `id,name${mid},tags,headshot_url,${HSX},headshot_urls,turnaround_url,race,traits,speech,levellabs_speech_id`,
    `id,name${mid},tags,headshot_url,${HSX},headshot_urls,turnaround_url`,
    `id,name${mid},tags,headshot_urls,${HSX},turnaround_url,race,traits,speech,levellabs_speech_id,height,weight,search_keywords,sex`,
    `id,name${mid},tags,headshot_urls,${HSX},turnaround_url,race,traits,speech,levellabs_speech_id,height,weight,search_keywords`,
    `id,name${mid},tags,headshot_urls,${HSX},turnaround_url,race,traits,speech,levellabs_speech_id`,
    `id,name${mid},tags,headshot_urls,${HSX},turnaround_url`,
    `id,name${mid},tags,headshot_url,turnaround_url,race,traits,speech,levellabs_speech_id,height,weight,search_keywords,sex`,
    `id,name${mid},tags,headshot_url,turnaround_url,race,traits,speech,levellabs_speech_id,height,weight,search_keywords`,
    `id,name${mid},tags,headshot_url,turnaround_url,race,traits,speech,levellabs_speech_id`,
    `id,name${mid},tags,headshot_url,turnaround_url`,
    `id,name${mid},tags,headshot_urls,turnaround_url,race,traits,speech,levellabs_speech_id,height,weight,search_keywords,sex`,
    `id,name${mid},tags,headshot_urls,turnaround_url,race,traits,speech,levellabs_speech_id,height,weight,search_keywords`,
    `id,name${mid},tags,headshot_urls,turnaround_url,race,traits,speech,levellabs_speech_id`,
    `id,name${mid},tags,headshot_urls,turnaround_url`,
  ];
}

/** DBs that have not applied `levellabs_speech_id` migration yet. */
function withoutLevellabsColumn(selectList: string): string {
  return selectList.replace(/,levellabs_speech_id/g, "");
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
      const withTax = await attachTaxonomyIfAvailable(supabase, base);
      const actors = await attachHeadshotUrlsIfAvailable(supabase, withTax);
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
  const raceKey = current.race?.trim().toLowerCase() ?? "";

  function score(a: ActorRow): number {
    let s = 0;
    for (const t of a.taxonomy ?? []) {
      if (termIds.has(t.id)) s += 2;
    }
    for (const tag of a.tags ?? []) {
      if (tagSet.has(tag.trim().toLowerCase())) s += 1;
    }
    const r2 = a.race?.trim().toLowerCase() ?? "";
    if (raceKey && r2 && raceKey === r2) s += 1;
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
