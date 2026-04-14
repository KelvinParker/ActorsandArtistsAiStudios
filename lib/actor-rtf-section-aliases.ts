/**
 * Section titles (after normalization) map to import field numbers.
 * Used by RTF / single-document imports; keep in sync with `actor-import-field-map.json`
 * and `docs/gemini-actor-folder-fields.md`.
 */
export const RTF_SECTION_ALIASES: Readonly<Record<number, readonly string[]>> = {
  1: ["name", "character name", "canonical name", "catalog name", "full name", "actor name"],
  2: ["stage name", "stage_name", "billing name"],
  3: ["pack name", "pack_name", "pack"],
  4: ["age range", "age_range"],
  5: ["age"],
  6: ["ethnicity"],
  7: ["race", "heritage", "ancestry"],
  8: ["sex", "gender"],
  9: ["height"],
  10: ["weight"],
  11: ["origin city", "origin_city", "origin", "hometown"],
  12: ["physical description", "physical_description", "look", "face dna", "face"],
  13: ["must keep identity traits", "must_keep_identity_traits", "identity traits", "must keep"],
  14: ["personality archetype", "personality_archetype", "personality"],
  15: ["role archetype", "role_archetype", "role", "crew role"],
  16: ["backstory summary", "backstory_summary", "backstory"],
  17: ["speech", "dialect", "cadence", "voice"],
  18: ["market segment", "market_segment", "market"],
  19: ["vocal range", "vocal_range"],
  20: ["primary goal", "primary_goal", "goal"],
  21: ["core wound", "core_wound", "wound"],
  22: ["fatal flaw", "fatal_flaw", "flaw"],
  23: ["signature style", "signature_style"],
  24: ["fashion style", "fashion_style", "fashion", "wardrobe"],
  25: ["mood keywords", "mood_keywords", "mood"],
  26: ["tags"],
  27: ["search keywords", "search_keywords", "search"],
  28: ["traits"],
  29: ["elevenlabs voice suggested id", "elevenlabs_voice_suggested_id", "elevenlabs", "voice id"],
  30: ["notes", "internal notes"],
  31: ["generation quality mode", "generation_quality_mode", "quality mode"],
  32: ["turnaround url", "turnaround_url", "turnaround sheet", "sheet url"],
  33: ["headshot urls", "headshot_urls", "headshots", "headshot list"],
};

export function normalizeSectionTitleLine(s: string): string {
  return s
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\*\*?/, "")
    .replace(/\*\*?$/, "")
    .replace(/^\d{1,2}[\.)]\s*/, "")
    .replace(/:\s*$/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/_/g, " ");
}

/** Longest alias first so e.g. "age range" wins over "age". */
export function sortedAliasPairs(): { num: number; norm: string }[] {
  const out: { num: number; norm: string }[] = [];
  for (const [numStr, aliases] of Object.entries(RTF_SECTION_ALIASES)) {
    const num = Number.parseInt(numStr, 10);
    for (const a of aliases) {
      out.push({ num, norm: normalizeSectionTitleLine(a) });
    }
  }
  out.sort((a, b) => b.norm.length - a.norm.length);
  return out;
}

const ALIAS_PAIRS = sortedAliasPairs();

const LABELS_BY_NUM = new Map<number, string[]>();
for (const [numStr, aliases] of Object.entries(RTF_SECTION_ALIASES)) {
  const num = Number.parseInt(numStr, 10);
  LABELS_BY_NUM.set(
    num,
    aliases.map((a) => normalizeSectionTitleLine(a)),
  );
}

export function matchSectionHeader(line: string): { num: number; inlineBody?: string } | null {
  const trimmed = line.trim();
  const numDot = /^(\d{1,2})[\.)]\s*(.*)$/i.exec(trimmed);
  if (numDot) {
    const n = Number.parseInt(numDot[1]!, 10);
    const rest = (numDot[2] ?? "").trim();
    if (Number.isFinite(n) && n >= 1 && n <= 33) {
      if (!rest) return { num: n };
      const rnorm = normalizeSectionTitleLine(rest);
      const labels = LABELS_BY_NUM.get(n) ?? [];
      const isLabelOnly =
        labels.includes(rnorm) ||
        labels.some((l) => rnorm.startsWith(`${l} `)) ||
        labels.some((l) => rnorm.startsWith(`${l}—`)) ||
        labels.some((l) => rnorm.startsWith(`${l}-`));
      if (isLabelOnly) return { num: n };
      return { num: n, inlineBody: rest };
    }
  }

  const norm = normalizeSectionTitleLine(trimmed);
  if (!norm) return null;
  for (const { num, norm: aliasNorm } of ALIAS_PAIRS) {
    if (norm === aliasNorm) return { num };
    if (norm.startsWith(`${aliasNorm} —`) || norm.startsWith(`${aliasNorm} -`)) return { num };
  }
  return null;
}
