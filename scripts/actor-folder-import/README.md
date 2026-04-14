# Import actors from local folders

**Supabase cannot read folders on your Mac.** The database lives in the cloud. This folder documents a **local import** flow: you keep a library on disk (or Dropbox, NAS, etc.), then run a script on a machine that has **network access** and your **service role key**; the script fills `public.actors` columns.

Your Next.js app (and future public APIs) then read from Supabase like any other client.

## Folder layouts

**Principle:** keep **one folder per actor** (everything for that person—numbered `.txt`, headshots, turnaround—lives together). That matches how admins think in the app (filter by pack, open one character, re-export one folder) and matches the **full-pack download** zip shape.

### A) Pack → many actors (recommended)

Each **pack** is one directory; **each actor is their own subdirectory** (slug by character name).

```text
MyActorLibrary/
  Riverside-Drive-Thru-Night-Shift/     ← pack_name (unless 3.txt overrides)
    marcus-cook/                        ← one actor = one folder
      1.txt     ← name (required)
      2.txt     ← stage_name
      4.txt     ← age_range e.g. 38-42
      headshots/
        headshot-01.jpg
      turnaround/
        turnaround.png
      ...
    jada-cashier/                       ← another actor = another folder
      1.txt
      ...
```

Import one pack zip at a time, or keep the whole library tree on disk and point the CLI at the root.

### B) Flat library root + default pack (still one folder per actor)

Actor folders sit **directly** under the library root—**still one folder per person**; the pack label is shared via `DEFAULT_PACK.txt` or env instead of a parent folder name:

```text
MyActorLibrary/
  DEFAULT_PACK.txt          ← optional; single line = pack_name for every actor folder below
  marcus-king/              ← one actor
    1.txt
    2.txt
    ...
  jada-cashier/             ← another actor
    1.txt
    ...
```

If there is no `DEFAULT_PACK.txt`, you can set env `IMPORT_DEFAULT_PACK_NAME` when running the script, or put **`3.txt`** (pack override) inside each actor folder.

## Numbered files → columns

See **`lib/actor-import-field-map.json`** for the authoritative list (`1.txt` … `33.txt`). For **Gemini / LLM** copy-paste tables and rules, see **`docs/gemini-actor-folder-fields.md`**. Summary:

| # | Column |
|---|--------|
| 1 | `name` (required) |
| 2 | `stage_name` |
| 3 | `pack_name` (optional override) |
| 4 | `age_range` (e.g. `35-45`; min/max parsed when possible) |
| 5–11 | `age`, `ethnicity`, `race`, `sex`, `height`, `weight`, `origin_city` |
| 12–13 | `physical_description`, `must_keep_identity_traits` |
| 14–18 | archetypes, `backstory_summary`, `speech`, `market_segment`, `vocal_range` |
| 19–25 | depth + look: goals, wounds, flaw, `signature_style`, `fashion_style`, `mood_keywords` |
| 26–28 | `tags`, `search_keywords`, `traits` (comma, semicolon, or newline separated → `text[]`) |
| 29–31 | `elevenlabs_voice_suggested_id` (29 — **optional**, recommended when you have an id; approve in **Voice review**), `notes`, `generation_quality_mode` |
| 32–33 | `turnaround_url`, `headshot_urls` (URLs comma or newline separated, max 5 headshots) |

## Images next to numbered `.txt` (admin / browser import only)

The CLI still expects **URLs** in `32.txt` / `33.txt`. In **`/admin/import-actors`**, you can drop images in the **same actor folder**; they are uploaded to Supabase Storage and override those slots.

**Pack layout** — put files next to `1.txt` or under known subfolders (attached to `Pack/Actor`, not a nested “actor”):

- **Turnaround (one sheet):** `turnaround/turnaround.jpg`, `turnaround.png`, or `spread.png` (not `spread-01.png`; numbered spreads are treated as views below).
- **Headshots (up to 5):** `headshot.jpg`, `headshot-01.jpg` … `headshot-05.jpg`, or `headshots/headshot-01.jpg` (matches the **Download full pack** zip layout).
- **Five separate view tiles:** `spread-01.jpg` … `spread-05.jpg` fill headshot slots when no `headshot-*` files are present.
- **Flat layout** — `ActorName/headshots/headshot-01.jpg` with **Default pack name** set in the UI (or `DEFAULT_PACK.txt` in a zip) so `pack_name` is correct.

You may use **`01.txt`** instead of **`1.txt`** (two-digit padding).

Empty or missing files are ignored.

## Run the import

### In the app (browser)

- **`/admin/actor-pipeline`** — copy/paste **AI prompts** (Gemini / ChatGPT), then load a zip, **pick turnaround + headshots** per actor, and import (text still comes from numbered `.txt` files).
- **`/admin/import-actors`** — **drop a .zip** or **pick a folder** for a faster path when filenames already match the auto rules (`headshot-01.jpg`, `turnaround/turnaround.png`, etc.).
- **`/admin/voice-review`** — approve **ElevenLabs voice ids** from `29.txt` (suggested) into production (`levellabs_speech_id`). When auditioning in ElevenLabs, use only previews/listening that are free for your plan under their terms.

All use the same Supabase upsert + Storage upload pipeline where applicable.

### From the CLI

From the **project root** (with `.env.local` containing `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`):

```bash
npm run import:actors -- --root "/Users/you/Documents/MyActorLibrary"
```

Dry run (print JSON only, no writes):

```bash
npm run import:actors -- --root "/Users/you/Documents/MyActorLibrary" --dry-run
```

## Upsert behavior

- **Pack layout:** match existing row by **`name` + `pack_name`** (parent folder or `3.txt`); update if found, else insert.
- **Flat layout:** match by **`name`** and `pack_name` IS NULL unless `DEFAULT_PACK.txt` / `3.txt` / env set a pack.

## Hosting “wherever”

- **Same computer:** run the script there; path is local.
- **NAS / Dropbox:** mount or sync the folder locally, then run the script with `--root` pointing at the mount.
- **CI server:** clone or sync the library, run script with secrets from CI env.
- **Supabase Storage:** you can upload a zip and unpack elsewhere, or build a later **Edge Function** that reads from a bucket—still not your raw Finder folders without sync.

## API for other programs

After rows exist in Supabase, other tools (ComfyUI, etc.) should call **your** HTTP API or use the Supabase REST API with a **controlled key** (service role only on server; for clients use RLS + anon or a dedicated read API). The repo’s **`/developers`** page summarizes the schema; a dedicated `GET /api/v1/actors/:id` can be added when you want a stable JSON contract.
