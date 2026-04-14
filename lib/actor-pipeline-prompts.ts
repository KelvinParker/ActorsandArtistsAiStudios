import fieldMap from "@/lib/actor-import-field-map.json";

function fieldTableLines(): string {
  return (fieldMap.files as { num: number; column: string; required?: boolean }[])
    .map((f) => `  ${f.num}.txt → ${f.column}${f.required ? " (required)" : ""}`)
    .join("\n");
}

/** Paste into Gemini / ChatGPT as system or first user block. */
export const AI_FOLDER_CONTRACT_PROMPT = `You are generating on-disk assets for an AI casting platform.

OUTPUT: a folder tree the human will zip and upload. Rules:
- One actor = one subfolder under a pack folder: PACK_NAME/ACTOR_SLUG/
- Required: ACTOR_SLUG/1.txt = canonical character name (single line or short phrase).
- Optional: 2.txt through 33.txt — one field per file, plain text body only (no JSON). Empty fields can be omitted.
- **29.txt** = optional but **recommended**: suggested ElevenLabs voice id when you have one. Skip it on first pass if you are still casting; you can add the id later in admin (casting or Voice review). When present, the platform stores it as a suggestion until an admin approves it into the production voice field.
- Images (JPEG/PNG/WebP/GIF) in the same actor folder OR in subfolders headshots/ and turnaround/:
  - turnaround/turnaround.png OR turnaround.png — one composite turnaround sheet.
  - headshots/headshot-01.jpg … headshot-05.jpg OR headshot.jpg — up to five headshots; slot 01 is primary cover.
- Do not put URLs in 32.txt/33.txt unless asked; the admin UI can assign images by filename instead.

ELEVENLABS (human workflow today; API assist later):
- Rich voice cues live in 17.txt (speech), 12–13 (look / must-keep), archetypes, backstory, etc.
- Voice id is optional at import time; including **29.txt** when you already have a match is recommended. Otherwise ship without it and **backfill** the id later (casting form or Voice review after you paste a brief into ElevenLabs and pick a voice).
- The human opens ElevenLabs Voice Library, pastes a “voice matching brief” from admin (Voice review or casting → Copy voice-matching brief), picks a voice, copies the voice id into 29.txt on the next export OR into casting any time.
- **Billing / terms:** only use ElevenLabs listening and voice **previews** that are free for your plan and allowed under their current terms; do not assume our app covers ElevenLabs charges.
- When 29.txt is present, it stays a *suggestion* until Voice review / casting approves it into production in Supabase.

FIELD MAP (file name → database column):
${fieldTableLines()}

Example tree:
  MyPack/
    marcus-cook/
      1.txt
      12.txt
      headshots/headshot-01.jpg
      turnaround/turnaround.png
    jada-cashier/
      1.txt
      ...
`;

export const FOLDER_TREE_EXAMPLE = `MyPack/
  marcus-cook/
    1.txt              ← name (required)
    4.txt              ← age_range, e.g. 35-45
    12.txt             ← physical_description
    headshots/
      headshot-01.jpg
    turnaround/
      turnaround.png
  jada-cashier/
    1.txt
    ...
`;
