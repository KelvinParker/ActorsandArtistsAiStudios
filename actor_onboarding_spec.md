# Universal Actor Schema (Actors and Artists AI Studios)

This is the **Universal Actor Schema**: one master document that unifies **internal Field IDs**, **Visual Continuity Protocols (VCP)**, and **Supabase `public.actors` columns** so Cursor and operators code against a single contract.

**Sources of truth (code):** `lib/types/actor.ts`, `lib/character-automation.ts`, `lib/actors-query.ts`, `supabase/migrations/*actors*.sql`, `app/admin/add-actor/actions.ts`, `app/create/actions.ts`.

**Do not** `DROP` and recreate `public.actors`. The table already exists and grows via **timestamped migrations**. See [Cursor workflow: SQL / Supabase](#cursor-workflow-sql--supabase) below.

---

## Universal Actor Onboarding Schema

Use the **Structured Actor Input Template** (end of this file) to digitize character DNA into the Actors and Artists AI Studios database.

---

## Visual Continuity Protocols (VCP)

| Protocol | Field IDs / columns | Rule |
|----------|---------------------|------|
| **VCP-1 Face DNA lock** | `physical_description`, `must_keep_identity_traits` | Distinct features + non‑negotiable consistency; combine in prompts; they do not replace reference URLs. |
| **VCP-2 Master still & panels** | `headshot_urls`, `headshot_url`, `headshot_2_url`… | **`headshot_urls[0]`** = master identity / gallery cover (**Field 5.0**). Legacy URL columns merge in app (`lib/actor-headshots.ts`). |
| **VCP-3 Turnaround** | `turnaround_url` | **Field 5.1** — 5-panel (or equivalent) sheet URL. |
| **VCP-4 Wardrobe & look** | `fashion_style`, `signature_style` | **Field 3.0** `fashion_style` = locked uniform line (migration `20260416140000`). **Field 1.13** `signature_style` = broader look / presence; keep both aligned when importing legacy rows. |
| **VCP-5 Visual tone** | `mood_keywords` | **Field 4.0** — lighting / palette / mood as free text or comma-separated phrases (`text`). |
| **VCP-6 Pipeline quality** | `generation_quality_mode` | Studio vs fast presets for generation. |
| **VCP-7 Discoverability** | `tags`, `search_keywords`, taxonomy | Do not replace Face DNA in `must_keep_identity_traits`. |

---

## Library expansion: region + archetype “packs”

| Pack slug | Pack name | Focus | Key archetypes (casting texture) |
|-----------|-----------|-------|----------------------------------|
| `delta_blues` | The Delta Blues | Mississippi / rural South | Farmers, small-town mechanics, weary matriarchs |
| `atl_tech_circle` | The ATL Tech Circle | Modern Atlanta | FinTech founders, high-end influencers, crypto-hustlers |
| `coastal_vibe` | The Coastal Vibe | Savannah / New Orleans | Artists, jazz musicians, mysterious locals |
| `youth_league` | The Youth League | Urban youth | Aspiring athletes (softball/baseball), young scholars, skaters |

Use **`pack_name`** (**Field 6.1**) for the readable batch label; use **taxonomy** + **`tags`** when you need slugs and filters.

### Example “cast the whole crew” pack names (same `pack_name` on every row in the batch)

Think **one location or institution + the full roster of people** you might shoot in a single storyline—not only leads.

| Premise | Example `pack_name` (human-readable) | Example roles you might cast (each = one actor row) |
|---------|--------------------------------------|------------------------------------------------------|
| Fast food | `Riverside Drive-Thru — Night Shift` | Cook, cashier, shift manager, busser / runner, regular customer |
| Grocery store | `Freshway Grocery — Saturday Crew` | Produce clerk, cashier, store manager, stocker, shopper |
| Mechanic shop | `King’s Garage — Bay Team` | Lead tech, apprentice, front-desk writer, parts runner, tow driver |
| School | `Lincoln High — Hall Pass` | Teacher, counselor, janitor, security, students (by grade band) |
| Playground / park | `Riverside Park — Summer ‘06` | Kids (playing age ranges), parent, coach, ice-cream vendor |

**Workflow:** pick one string for **`pack_name`** for the whole batch, then add or upsert actors into that pack as you expand the world (same label = same filter in the gallery). You can still use **region / archetype** taxonomy for cross-cutting queries (e.g. “Southern accent” across multiple packs).

---

## I. Core identity and identity lock (high priority)

| Field ID | Supabase column | Input / mapping | Description |
|----------|-----------------|-----------------|-------------|
| 1.0 | `name` | Core Identity | Full legal name of the character. |
| 1.1 | `age` | Age | Exact age (number in product terms). **DB today:** `age` is **`text`** — store digits as string (e.g. `34`) or add a typed column later. Casting also uses **`age_range`** + **`age_range_min` / `age_range_max`**. |
| 1.2 | `ethnicity` | Race | Character’s racial/ethnic background. **`race`** is used in admin picklists; keep them consistent when importing. |
| 1.3 | `sex` | Sex | Character’s gender / sex. |
| 1.4 | `origin_city` | Region | Memphis, Atlanta, Delta, etc. |
| 2.0 | `physical_description` | Face DNA | Distinct features (eyes, skin, facial hair). Migration `20260416120000`. |
| 2.1 | `must_keep_identity_traits` | Identity Lock | Non-negotiable traits for AI consistency. |

**Supplemental (same table):** `stage_name` (1.0b), `age_range` / min / max (1.1b), `height`, `weight` (body metrics, text).

---

## II. Performance and narrative bible

| Field ID | Supabase column | Input / mapping | Description |
|----------|-----------------|-----------------|-------------|
| 1.5 | `personality_archetype` | Archetype | e.g. The Sage, The Architect, The Muscle. |
| 1.6 | `role_archetype` | Narrative Role | Lead, Antagonist, Supporting, etc. |
| 1.7 | **`backstory_summary`** | Backstory | Summary of the character’s history. **Canonical spec label “biography”** maps here — there is **no** `biography` column in this repo (do not run a greenfield `CREATE TABLE` that omits `backstory_summary`). |
| 1.8 | `speech` | Vocal Profile | Accent, tone, and pacing (ElevenLabs / `levellabs_speech_id`). |
| 1.9 | `market_segment` | Niche | Urban Drama, Tech-Noir, Youth Sports, etc. |

**Extended (optional Field IDs for tooling):** 1.10 `primary_goal`, `core_wound`, `fatal_flaw` · 1.11 `vocal_range` · 1.12 `traits` · 1.13 `signature_style` · 1.14 `mood_tone` (automation profile only — may sync into **Field 4.0** on save).

---

## III. Visual assets and style continuity

| Field ID | Supabase column | Input / mapping | Description |
|----------|-----------------|-----------------|-------------|
| 3.0 | `fashion_style` | Locked Uniform | Standard clothing set for continuity. Migration `20260416140000`. |
| 4.0 | `mood_keywords` | Visual Tone | Lighting / color palette (e.g. neon-purple). `text` — single phrase or comma-separated. Migration `20260416140000`. |
| 5.0 | `headshot_urls` | Master Identity | Primary portrait is **`headshot_urls[0]`**; up to five URLs per app rules. |
| 5.1 | `turnaround_url` | 5-Panel Sheet | URL to the technical turnaround sheet. |

**Legacy / merge:** `headshot_url`, `headshot_2_url` … `headshot_5_url` — mirrored slots; app merges with **`headshot_urls`**. **`tags`** / **`search_keywords`** remain available for extra discoverability (also **§IV**).

---

## IV. Administrative and metadata

| Field ID | Supabase column | Input / mapping | Description |
|----------|-----------------|-----------------|-------------|
| 6.0 | `tags` | Search Keywords | Comma-separated in forms; stored as **`text[]`** in Postgres. |
| 6.1 | `pack_name` | Demographic Pack | e.g. “The Delta Blues”, “The Youth League”. Migration `20260416130000`. |
| 7.0 | `notes` | Character Notes | Final column for production-specific notes (same migration). |

**Also:** 6.0b `search_keywords`, `generation_quality_mode`, `visibility`, `is_user_generated`, `created_by_user_id`, `levellabs_speech_id`.

---

## Taxonomy (related tables)

**`taxonomy_terms`** + **`actor_taxonomy`** — normalized labels; exposed as `ActorRow.taxonomy` when queries join (`lib/actors-query.ts`).

---

## Structured Actor Input Template (copy for each character)

```text
--- I. CORE & IDENTITY LOCK ---
name: <1.0>
age: <1.1 — string digits in DB today>
ethnicity: <1.2>
sex: <1.3>
origin_city: <1.4>
stage_name: <1.0b optional>
age_range / min / max: <1.1b optional>
height:
weight:
physical_description: <2.0>
must_keep_identity_traits: <2.1>

--- II. PERFORMANCE & NARRATIVE ---
personality_archetype: <1.5>
role_archetype: <1.6>
backstory_summary: <1.7 — use for "biography">
speech: <1.8>
market_segment: <1.9>
primary_goal / core_wound / fatal_flaw: <1.10>
vocal_range: <1.11>
traits: <1.12>
signature_style: <1.13>

--- III. VISUAL ASSETS & STYLE ---
fashion_style: <3.0>
mood_keywords: <4.0>
headshot_urls: <5.0 — [0] = master>
turnaround_url: <5.1>
generation_quality_mode:

--- IV. ADMIN ---
tags: <6.0>
pack_name: <6.1>
notes: <7.0>
search_keywords: <6.0b>
```

---

## Cursor workflow: SQL / Supabase

### Never greenfield-recreate `public.actors`

Chat-style instructions such as *“Create a table public.actors with …”* **must not** replace this project’s table. You will lose migrations, RLS plans, storage wiring, and column history.

**Always:** `ALTER TABLE public.actors ADD COLUMN IF NOT EXISTS …` in a new file under `supabase/migrations/`, then update `ActorRow`, queries, and server actions.

### Mapping: ideal “CREATE TABLE” wording → this repository

| Stated column / type | Actual in this repo |
|----------------------|---------------------|
| `id` uuid | Yes (`gen_random_uuid()`). |
| `name` text | Yes. |
| `age` int4 | **`age` text** + **`age_range`** + **`age_range_min` / `age_range_max`** for casting bands. |
| `ethnicity`, `sex`, `origin_city` text | Yes (+ **`race`** for picklists). |
| `physical_description`, `must_keep_identity_traits` | Yes (`20260416120000`). |
| `personality_archetype`, `role_archetype` | Yes. |
| `biography` text | **Use `backstory_summary`** — no `biography` column unless you add a dedicated migration and migrate data. |
| `speech`, `market_segment` | Yes. |
| `fashion_style`, `mood_keywords` | Yes (`20260416140000`). |
| `headshot_urls` text[], `turnaround_url` text | Yes (+ legacy `headshot_url` … `headshot_5_url`). |
| `tags` text[] | Yes (parse comma input before insert). |
| `pack_name`, `notes` | Yes (`20260416130000`). |
| Defaults `'N/A'` | **Avoid** — use **`NULL`** for unknowns; app/UI formats empty state. |

### Schema change checklist

1. Read `lib/types/actor.ts` + latest `supabase/migrations/*actors*.sql`.
2. Add a new migration; never edit old migration files in place if already applied.
3. Update `ActorRow`, `lib/actors-query.ts` attach/fallback paths, admin/create actions, and any download/API payloads that must expose new fields.

---

## Comma-separated column list (current app model)

`id`, `name`, `stage_name`, `age`, `age_range`, `age_range_min`, `age_range_max`, `ethnicity`, `race`, `sex`, `height`, `weight`, `physical_description`, `fashion_style`, `mood_keywords`, `tags`, `pack_name`, `notes`, `search_keywords`, `traits`, `speech`, `vocal_range`, `personality_archetype`, `role_archetype`, `levellabs_speech_id`, `origin_city`, `backstory_summary`, `primary_goal`, `core_wound`, `fatal_flaw`, `signature_style`, `market_segment`, `must_keep_identity_traits`, `generation_quality_mode`, `headshot_url`, `headshot_urls`, `headshot_2_url`, `headshot_3_url`, `headshot_4_url`, `headshot_5_url`, `turnaround_url`, `created_by_user_id`, `is_user_generated`, `visibility`

---

*Reconciled with this repository’s migrations and server actions; extend this file when the schema grows.*
