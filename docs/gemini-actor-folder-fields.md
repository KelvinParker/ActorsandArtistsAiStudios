# Gemini (or any LLM): numbered `.txt` fields for one actor

Use this with **`lib/actor-import-field-map.json`** as the source of truth. Each **character** lives in **one folder**; each field is **`N.txt`** (or **`NN.txt`**) containing **plain text only** for that column.

**End goal:** those folders get **zipped and uploaded into your app** (e.g. **`/admin/actor-pipeline`** or **`/admin/import-actors`**) so the program reads the `.txt` files, uploads images when present, and writes **Supabase**. Anything below about Gemini or Cursor is only **prep** to produce files your site already accepts.

---

## Field list (`1.txt` … `33.txt`)

| # | File | Column | What to put |
|---|------|--------|-------------|
| **1** | `1.txt` | `name` | **Required.** Canonical catalog name (one line). |
| 2 | `2.txt` | `stage_name` | Stage / billing name if different; else omit. |
| 3 | `3.txt` | `pack_name` | Optional pack override (often omitted if folder is `Pack/Actor/`). |
| 4 | `4.txt` | `age_range` | Band like `35-45` or single `42` (importer parses min/max when possible). |
| 5 | `5.txt` | `age` | Legacy single age; often empty if `4` is set. |
| 6 | `6.txt` | `ethnicity` | Free text. |
| 7 | `7.txt` | `race` | Free text. |
| 8 | `8.txt` | `sex` | Free text. |
| 9 | `9.txt` | `height` | e.g. `6'1"` or `185 cm`. |
| 10 | `10.txt` | `weight` | e.g. `190 lbs`. |
| 11 | `11.txt` | `origin_city` | Origin. |
| 12 | `12.txt` | `physical_description` | Look / Face DNA style. |
| 13 | `13.txt` | `must_keep_identity_traits` | Must-not-change traits for renders. |
| 14 | `14.txt` | `personality_archetype` | Archetype. |
| 15 | `15.txt` | `role_archetype` | Story / crew role. |
| 16 | `16.txt` | `backstory_summary` | Tight backstory. |
| 17 | `17.txt` | `speech` | Dialect, cadence, sample line — **primary voice-matching hook**. |
| 18 | `18.txt` | `market_segment` | Casting / product bucket. |
| 19 | `19.txt` | `vocal_range` | Voice / singing notes if relevant. |
| 20 | `20.txt` | `primary_goal` | What they want. |
| 21 | `21.txt` | `core_wound` | Emotional wound. |
| 22 | `22.txt` | `fatal_flaw` | Self-sabotage. |
| 23 | `23.txt` | `signature_style` | How they present. |
| 24 | `24.txt` | `fashion_style` | Wardrobe. |
| 25 | `25.txt` | `mood_keywords` | Tone / lighting keywords. |
| 26 | `26.txt` | `tags` | List: commas, semicolons, or newlines (→ DB `text[]`). |
| 27 | `27.txt` | `search_keywords` | Same list rules as 26. |
| 28 | `28.txt` | `traits` | Same list rules as 26. |
| 29 | `29.txt` | `elevenlabs_voice_suggested_id` | **Optional.** Real ElevenLabs voice id only; omit if unknown (admin can backfill). Stored as **suggestion** until Voice review. |
| 30 | `30.txt` | `notes` | Internal notes. |
| 31 | `31.txt` | `generation_quality_mode` | Short label your pipeline understands. |
| 32 | `32.txt` | `turnaround_url` | **One** public image URL, or omit and use `turnaround/turnaround.*` files in zip. |
| 33 | `33.txt` | `headshot_urls` | Up to **5** URLs, comma or newline separated, or omit and use `headshots/` files. |

**CLI import** expects URLs in 32–33 if you use those files. **Admin browser import** can use image files instead; see `scripts/actor-folder-import/README.md`.

---

## Rules for the model (paste into Gemini)

1. **Output shape:** For **one** character, produce **plain text only**, **one field per file**: `1.txt` … `33.txt` (or `01.txt` … `33.txt`). Do **not** put the whole character in one JSON blob unless the user asked for that separately.

2. **Required:** **`1.txt` must exist** with a non-empty **name** (single primary line).

3. **Omit empties:** If a field has no useful content, **omit that file** (empty files are ignored by importers anyway).

4. **No invented URLs:** For **`32.txt`** / **`33.txt`**, output URLs **only** if the user asked for real, hosted links you control. Otherwise omit.

5. **`29.txt`:** **Optional.** Only include a real ElevenLabs voice id string. Never invent an id.

6. **Lists (26–28):** Separate items with **commas**, **semicolons**, or **newlines** — not JSON arrays.

7. **`4.txt`:** Prefer **`min-max`** (e.g. `28-35`) or a single integer; avoid unparseable prose.

8. **Consistency:** `12`–`13` match the same face; `17` matches the same person as `12`–`16`.

9. **Pack:** Prefer matching the folder layout `PackName/ActorSlug/`; use **`3.txt`** only to override `pack_name` when needed.

10. **Images:** Never put binary inside `.txt`. Prefer pack layout: `headshots/headshot-01.jpg` … `headshot-05.*`, `turnaround/turnaround.png` (or `.jpg` / `.webp`). **Loose names in the actor folder are also recognized** (import normalizes them before slot assignment; see `lib/actor-loose-image-path.ts`): `{Any Prefix} Headshot.ext` or `{Prefix}_headshot.ext` → primary headshot; `{Prefix} headshot-02.ext`, `headshot_03.ext`, or `headshot 04.ext` → slots 2–5; `{Prefix} turnaround.ext`, `{Slug}_turnaround.ext`, or `turnaround.ext` at folder root → turnaround. Extensions: jpeg, jpg, png, webp, gif.

11. **ElevenLabs previews:** If the human uses ElevenLabs to audition voices, they should use only previews/listening that are **free for their plan** and allowed under **current ElevenLabs terms** (see `elevenlabsPreviewUsageNote` in `lib/elevenlabs-links.ts`).

12. **Safety:** Default to **fictional** characters; no real-person impersonation without explicit clearance.

13. **RTF option (Option C):** You may output **one `.rtf` per actor** instead of `1.txt`–`33.txt`. Each field is a **section**: put the **section title** on its own line (exact wording from the Option C table below, or `N.` / `N)` plus an optional label). The **body** is all text until the next section title. The **Name** section is required (same as `1.txt`). If you also emit **images**, use either the usual subfolders (`headshots/headshot-01.jpg`, `turnaround/turnaround.png`) **or** paired names: `{FolderSlug}_headshot.png` and `{FolderSlug}_turnaround.png` next to the RTF.

14. **RTF fidelity:** Prefer **simple Word/Google RTF** (headings optional). Avoid embedding large inline images inside the RTF for field text; keep images as separate files.

---

## One-line instruction (prepend to a Gemini chat)

**Files:** Generate one actor folder: plain text only in files `1.txt`–`33.txt` per the table in `docs/gemini-actor-folder-fields.md`; `1.txt` required; omit unknown fields; no fake URLs or voice ids; follow the rules section in that doc.

**RTF:** Or generate one `.rtf` per actor with section titles exactly as in **Option C** (below); **Name** section required; same omit-empty / no-fake-URL rules; images as separate files beside the RTF or under `headshots/` / `turnaround/`.

---

## Option C: Single `.rtf` per actor (section titles)

The app maps **section title lines** to the same columns as `1.txt`–`33.txt`. Titles are matched **case-insensitive**; common synonyms work (see `lib/actor-rtf-section-aliases.ts` for the full list).

**Preferred title line** (one line, then body text below it):

| # | Preferred section title line |
|---|------------------------------|
| 1 | Name |
| 2 | Stage name |
| 3 | Pack name |
| 4 | Age range |
| 5 | Age |
| 6 | Ethnicity |
| 7 | Race |
| 8 | Sex |
| 9 | Height |
| 10 | Weight |
| 11 | Origin city |
| 12 | Physical description |
| 13 | Must keep identity traits |
| 14 | Personality archetype |
| 15 | Role archetype |
| 16 | Backstory summary |
| 17 | Speech |
| 18 | Market segment |
| 19 | Vocal range |
| 20 | Primary goal |
| 21 | Core wound |
| 22 | Fatal flaw |
| 23 | Signature style |
| 24 | Fashion style |
| 25 | Mood keywords |
| 26 | Tags |
| 27 | Search keywords |
| 28 | Traits |
| 29 | ElevenLabs voice suggested id |
| 30 | Notes |
| 31 | Generation quality mode |
| 32 | Turnaround url |
| 33 | Headshot urls |

**Alternate headers:** `1. Name`, `2. Stage name`, … `33. Headshot urls` (number + label) also work; if the rest of that line continues with real content (not just the label), that content is treated as the start of the field body.

**Storage layout:** Example: `actor-assets/Camille_St_James/Camille_St_James.rtf` plus `Camille_St_James_headshot.png` / `Camille_St_James_turnaround.png`. Import via **`/admin/import-actors`** (zip/folder) or **`POST /api/admin/sync-actors-from-storage`** when your sync bucket/prefix includes that folder.

---

## Option B: Cursor Composer (optional prep — still ends in your app)

If Gemini (or another model) gives you **one document** with sections for each field instead of separate files, you can use **Cursor** locally to split it into `1.txt` … **`33.txt`**. That is **not** where the roster lives: when the folder looks right, you **zip it and import it in the product** (admin UI). The site is the system of record.

**Long term:** you do **not** rely on Cursor for ops. Either have the **model emit the folder/zip directly**, or add **in-app tooling** (paste → split → import) so admins never need an IDE to ship characters.

This repo uses **33** fields, not 31 — include 32–33 only if you have turnaround / headshot **URLs**; otherwise omit those files and add images in the zip per `scripts/actor-folder-import/README.md`.

### Folder layout (matches import)

Put the actor **inside a pack folder** so `pack_name` is correct:

```text
YourPackName/
  cami-st-james/        ← slug; ASCII folder names zip more cleanly
    1.txt
    2.txt
    …
```

If you truly need a **flat** tree (`cami-st-james/1.txt` only), set **Default pack name** in `/admin/import-actors` or add **`DEFAULT_PACK.txt`** (one line = pack name) next to the actor folder before zipping.

### Steps

1. Save the model output as something like **`character_data.md`** in the repo (or a temp path).
2. Open **Composer** (e.g. **Cmd+I** / **Ctrl+I**).
3. Use a prompt like:

```text
Read docs/gemini-actor-folder-fields.md and lib/actor-import-field-map.json.

Open character_data.md. It contains numbered character fields (1 through 33) for one actor.

Create the directory YourPackName/cami-st-james/ (use the pack and slug I specify). Inside it, create one file per field: 1.txt, 2.txt, … up to 33.txt. Each file must contain ONLY the plain text body for that field—no markdown headings, no JSON. Omit any file whose content would be empty.

Do not invent URLs in 32.txt or 33.txt or a fake voice id in 29.txt; leave those files out if not provided.
```

Replace **`YourPackName`** and **`cami-st-james`** with your real pack and actor folder name.

### Scale (100+ characters)

Repeat **per actor**: one markdown (or paste) → one Composer run → one folder under the same pack. For **many** actors in one go, paste a manifest (e.g. “Actor A: … / Actor B: …”) and ask Cursor to emit **`Pack/actor-slug/*.txt`** for each — still keep **one folder per actor**.

---

## Where this lands in the product (your site ingests here)

- **In-app (primary):** **`/admin/actor-pipeline`** (review images + text) or **`/admin/import-actors`** (fast zip/folder drop) — both push to **Supabase**.
- **CLI (optional):** `npm run import:actors` for machines with `.env.local` + service role.
- **Schema:** `lib/actor-import-field-map.json`
- **Human readme:** `scripts/actor-folder-import/README.md`
