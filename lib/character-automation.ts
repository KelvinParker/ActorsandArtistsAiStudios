import {
  coerceCastingHeightEnum,
  coerceCastingRaceEthnicityEnum,
  coerceCastingSexEnum,
} from "@/lib/casting-picklists";
import { sanitizeRtfImportFieldText } from "@/lib/sanitize-rtf-import-field";
import { parseAgeRangeText } from "@/lib/playing-age";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL_CANDIDATES = [
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-1.5-pro-latest",
  "gemini-1.5-flash",
] as const;

type ListModelsResponse = {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
};
const FAL_QUEUE_BASE = "https://queue.fal.run";
const FAL_FLUX_MODEL = "fal-ai/flux-pro/v1.1";
const FAL_INSTANT_CHARACTER_MODEL = "fal-ai/instant-character";
const FLOW_MODEL_PRO = "nano-banana-pro";

export type HeadshotProvider = "flow" | "flux";
export type TurnaroundProvider = "flux" | "nano-banana";
export type QualityMode = "fast" | "studio";

export type AutomationProviderConfig = {
  headshotProvider: HeadshotProvider;
  turnaroundProvider: TurnaroundProvider;
  qualityMode?: QualityMode;
};

type ExpandedCharacter = {
  name: string;
  stage_name: string | null;
  age_range: string;
  role_archetype: string | null;
  origin_city: string | null;
  ethnicity: string | null;
  sex: string | null;
  height: string | null;
  weight: string | null;
  vocal_range: string | null;
  personality_archetype: string | null;
  backstory_summary: string | null;
  primary_goal: string | null;
  core_wound: string | null;
  fatal_flaw: string | null;
  signature_style: string | null;
  market_segment: string | null;
  mood_tone: string | null;
  must_keep_traits: string | null;
  tags: string[];
  traits: string[];
  speech: string | null;
  visual_prompt: string;
  turnaround_prompt: string;
};

const REFERENCE_SHEET_RULES = `
Create a professional character reference sheet based strictly on the uploaded reference image.
Use a clean, neutral plain background and present the sheet as a technical model turnaround while
matching the exact visual style of the reference (same realism level, rendering approach, texture,
color treatment, and overall aesthetic). Arrange the composition into two horizontal rows.
Top row: four full-body standing views placed side-by-side in this order: front view, left profile
view (facing left), right profile view (facing right), back view.
Bottom row: three highly detailed close-up portraits aligned beneath the full-body row in this order:
front portrait, left profile portrait (facing left), right profile portrait (facing right).
Maintain perfect identity consistency across every panel. Keep the subject in a relaxed A-pose and
with consistent scale and alignment between views, accurate anatomy, and clear silhouette; ensure even
spacing and clean panel separation, with uniform framing and consistent head height across the full-body
lineup and consistent facial scale across the portraits.
Lighting should be consistent across all panels (same direction, intensity, and softness), with natural,
controlled shadows that preserve detail without dramatic mood shifts.
Output a crisp, print-ready reference sheet look, sharp details.
`.trim();

const NO_REFERENCE_SHEET_RULES = `
Create a professional character reference sheet of [PUT YOUR CHARACTER DESCRIPTION HERE].
Use a clean, neutral plain background and present the sheet as a technical model turnaround in a
photographic style. Arrange the composition into two horizontal rows.
Top row: four full-body standing views placed side-by-side in this order: front view, left profile
view (facing left), right profile view (facing right), back view.
Bottom row: three highly detailed close-up portraits aligned beneath the full-body row in this order:
front portrait, left profile portrait (facing left), right profile portrait (facing right).
Maintain perfect identity consistency across every panel. Keep the subject in a relaxed A-pose and
with consistent scale and alignment between views, accurate anatomy, and clear silhouette; ensure even
spacing and clean panel separation, with uniform framing and consistent head height across the full-body
lineup and consistent facial scale across the portraits.
Lighting should be consistent across all panels (same direction, intensity, and softness), with natural,
controlled shadows that preserve detail without dramatic mood shifts.
Output a crisp, print-ready reference sheet look, sharp details.
`.trim();

export type AutomatedCharacterDraft = {
  profile: ExpandedCharacter;
  headshots: string[];
  turnaroundUrl: string | null;
};

const SELF_CORRECT_MAX_ATTEMPTS = 3;

function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .slice(0, 16);
}

function parseJsonFromModelText(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Gemini returned empty content.");
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    throw new Error("Gemini response was not valid JSON.");
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function extractTextFromGeminiResponse(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const root = payload as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  return (
    root.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

async function expandSeedPrompt(seedPrompt: string): Promise<ExpandedCharacter> {
  const apiKey = requireEnv("GOOGLE_GENERATIVE_AI_API_KEY");
  const systemInstruction =
    "You are a character development engine for a cinematic casting app. Return only strict JSON.";
  const userInstruction = `
Expand this seed prompt into a production casting profile:
"${seedPrompt}"

Return strict JSON with exactly these keys:
{
  "name": string,
  "stage_name": string | null,
  "age_range": "NN-NN",
  "role_archetype": string | null,
  "origin_city": string | null,
  "ethnicity": string | null,
  "sex": string | null,
  "height": string | null,
  "weight": string | null,
  "vocal_range": string | null,
  "personality_archetype": string | null,
  "backstory_summary": string | null,
  "primary_goal": string | null,
  "core_wound": string | null,
  "fatal_flaw": string | null,
  "signature_style": string | null,
  "market_segment": string | null,
  "mood_tone": string | null,
  "must_keep_traits": string | null,
  "tags": string[],
  "traits": string[],
  "speech": string | null,
  "visual_prompt": string,
  "turnaround_prompt": string
}

Rules:
- Keep dark, gritty cinematic tone.
- visual_prompt must describe a premium 9:16 headshot.
- turnaround_prompt must describe full body turnaround sheet.
- No markdown, no prose, JSON only.
`.trim();

  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ parts: [{ text: userInstruction }] }],
    generationConfig: { temperature: 0.6, responseMimeType: "application/json" },
  };

  const availableGenerateModels: string[] = [];
  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { cache: "no-store" },
    );
    if (listRes.ok) {
      const listJson = (await listRes.json()) as ListModelsResponse;
      for (const model of listJson.models ?? []) {
        const name = String(model.name ?? "").replace(/^models\//, "");
        const methods = model.supportedGenerationMethods ?? [];
        if (!name) continue;
        if (methods.includes("generateContent")) {
          availableGenerateModels.push(name);
        }
      }
    }
  } catch {
    // Best-effort only; fallback to static candidates.
  }

  const modelQueue = (() => {
    if (availableGenerateModels.length === 0) return [...GEMINI_MODEL_CANDIDATES];
    const preferred = GEMINI_MODEL_CANDIDATES.filter((m) => availableGenerateModels.includes(m));
    // Use only vetted model ids to avoid costly/unsupported preview models.
    return preferred.length > 0 ? preferred : [...GEMINI_MODEL_CANDIDATES];
  })();

  let raw: unknown = null;
  let lastError = "Gemini expand failed.";
  for (const model of modelQueue) {
    const res = await fetch(
      `${GEMINI_API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      lastError = `Gemini expand failed on ${model} (${res.status}): ${body.slice(0, 280)}`;
      continue;
    }
    raw = await res.json();
    break;
  }
  if (!raw) {
    throw new Error(lastError);
  }
  const text = extractTextFromGeminiResponse(raw);
  const parsed = parseJsonFromModelText(text);

  const ageRange = String(parsed.age_range ?? "").trim();
  const age = parseAgeRangeText(ageRange);
  if (!age.ok) throw new Error(`Gemini age range invalid: ${age.error}`);

  return {
    name: sanitizeRtfImportFieldText(String(parsed.name ?? "").trim()) || "Untitled Character",
    stage_name: (() => {
      const sn = sanitizeRtfImportFieldText(String(parsed.stage_name ?? "").trim());
      return sn || null;
    })(),
    age_range: age.text ?? ageRange,
    role_archetype: String(parsed.role_archetype ?? "").trim() || null,
    origin_city: String(parsed.origin_city ?? "").trim() || null,
    ethnicity: (() => {
      const raw = String(parsed.ethnicity ?? parsed.race ?? "").trim();
      if (!raw) return null;
      return coerceCastingRaceEthnicityEnum(raw);
    })(),
    sex: (() => {
      const raw = String(parsed.sex ?? "").trim();
      if (!raw) return null;
      return coerceCastingSexEnum(raw);
    })(),
    height: (() => {
      const raw = String(parsed.height ?? "").trim();
      if (!raw) return null;
      return coerceCastingHeightEnum(raw);
    })(),
    weight: String(parsed.weight ?? "").trim() || null,
    vocal_range: String(parsed.vocal_range ?? "").trim() || null,
    personality_archetype: String(parsed.personality_archetype ?? "").trim() || null,
    backstory_summary: String(parsed.backstory_summary ?? "").trim() || null,
    primary_goal: String(parsed.primary_goal ?? "").trim() || null,
    core_wound: String(parsed.core_wound ?? "").trim() || null,
    fatal_flaw: String(parsed.fatal_flaw ?? "").trim() || null,
    signature_style: String(parsed.signature_style ?? "").trim() || null,
    market_segment: String(parsed.market_segment ?? "").trim() || null,
    mood_tone: String(parsed.mood_tone ?? "").trim() || null,
    must_keep_traits: String(parsed.must_keep_traits ?? "").trim() || null,
    tags: normalizeTags(parsed.tags),
    traits: normalizeTags(parsed.traits),
    speech: String(parsed.speech ?? "").trim() || null,
    visual_prompt:
      String(parsed.visual_prompt ?? "").trim() ||
      `${seedPrompt}, cinematic portrait, gritty realism, 9:16`,
    turnaround_prompt:
      String(parsed.turnaround_prompt ?? "").trim() ||
      `${seedPrompt}, full body turnaround sheet, front side back`,
  };
}

function fallbackProfileFromSeed(seedPrompt: string): ExpandedCharacter {
  const ageMatch = seedPrompt.match(/(\d{2})\s*[-–]\s*(\d{2})/);
  const ageRange = ageMatch ? `${ageMatch[1]}-${ageMatch[2]}` : "22-28";
  const age = parseAgeRangeText(ageRange);
  const cleaned = seedPrompt.trim();
  const defaultName = cleaned.split(/[,.:-]/)[0]?.trim() || "Untitled Character";

  return {
    name: defaultName,
    stage_name: null,
    age_range: age.ok && age.text ? age.text : "22-28",
    role_archetype: null,
    origin_city: null,
    ethnicity: null,
    sex: null,
    height: null,
    weight: null,
    vocal_range: null,
    personality_archetype: null,
    backstory_summary: cleaned,
    primary_goal: null,
    core_wound: null,
    fatal_flaw: null,
    signature_style: null,
    market_segment: null,
    mood_tone: null,
    must_keep_traits: null,
    tags: [],
    traits: [],
    speech: null,
    visual_prompt: `${cleaned}, cinematic portrait, 9:16, realistic studio-quality character headshot`,
    turnaround_prompt: `${cleaned}, professional technical character reference sheet with consistent identity`,
  };
}

function getStringArray(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((v) => String(v ?? "").trim())
    .filter((v) => /^https?:\/\//i.test(v));
}

function extractImageUrls(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as {
    images?: Array<{ url?: string }>;
    image?: { url?: string };
    output?: unknown;
    data?: unknown;
    headshots?: unknown;
    turnaround?: { url?: string } | string;
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType?: string; data?: string };
          fileData?: { mimeType?: string; fileUri?: string; uri?: string; url?: string };
        }>;
      };
    }>;
  };

  const fromImages = (p.images ?? [])
    .map((i) => String(i?.url ?? "").trim())
    .filter((u) => /^https?:\/\//i.test(u));
  if (fromImages.length) return fromImages;

  const fromSingle = String(p.image?.url ?? "").trim();
  if (/^https?:\/\//i.test(fromSingle)) return [fromSingle];

  const outputUrls = getStringArray(p.output);
  if (outputUrls.length) return outputUrls;

  const dataUrls = getStringArray(p.data);
  if (dataUrls.length) return dataUrls;

  const headshotUrls = getStringArray(p.headshots);
  if (headshotUrls.length) return headshotUrls;

  const turnaround =
    typeof p.turnaround === "string"
      ? p.turnaround
      : String(p.turnaround?.url ?? "").trim();
  if (/^https?:\/\//i.test(turnaround)) return [turnaround];

  const fromCandidates: string[] = [];
  for (const c of p.candidates ?? []) {
    for (const part of c.content?.parts ?? []) {
      const fileUri =
        part.fileData?.fileUri || part.fileData?.uri || part.fileData?.url || "";
      if (/^https?:\/\//i.test(fileUri)) {
        fromCandidates.push(fileUri);
        continue;
      }
      const mime = part.inlineData?.mimeType || "image/png";
      const data = part.inlineData?.data || "";
      if (data) {
        fromCandidates.push(`data:${mime};base64,${data}`);
      }
    }
  }
  if (fromCandidates.length) return fromCandidates;

  return [];
}

async function listGenerateContentModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as ListModelsResponse;
    return (data.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => String(m.name ?? "").replace(/^models\//, ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function runGoogleDirectImages(
  prompt: string,
  count: number,
  preferredModels: readonly string[],
): Promise<string[]> {
  const apiKey = requireEnv("GOOGLE_GENERATIVE_AI_API_KEY");
  const available = await listGenerateContentModels(apiKey);
  const configuredImageModel = process.env.IMAGE_MODEL?.trim() || "";
  const nonPreview = (model: string) => !/preview/i.test(model);
  const imageLike = available.filter(
    (m) => /(nano|image|vision|flash)/i.test(m) && nonPreview(m),
  );
  const queue = [
    ...new Set(
      [
        configuredImageModel,
        ...preferredModels,
        ...imageLike,
      ].filter((m) => Boolean(m) && nonPreview(String(m))),
    ),
  ];
  let lastError = "Google direct image generation failed.";

  for (const model of queue) {
    const res = await fetch(
      `${GEMINI_API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      lastError = `Google direct image generation failed on ${model} (${res.status}): ${body.slice(0, 240)}`;
      continue;
    }
    const payload = await res.json();
    const urls = extractImageUrls(payload).slice(0, count);
    if (urls.length > 0) return urls;
    lastError = `Google direct image generation returned no images on ${model}.`;
  }

  throw new Error(lastError);
}

function normalizeHttpUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const t = String(u ?? "").trim();
    if (!/^https?:\/\//i.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

async function withRetries<T>(
  label: string,
  run: (attempt: number) => Promise<T>,
  validate: (result: T) => boolean,
  maxAttempts = SELF_CORRECT_MAX_ATTEMPTS,
): Promise<T> {
  let last: T | null = null;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await run(attempt);
      last = result;
      if (validate(result)) return result;
      lastError = new Error(`${label} validation failed (attempt ${attempt}).`);
    } catch (err) {
      lastError = err;
    }
  }
  if (last && validate(last)) return last;
  if (lastError instanceof Error) throw lastError;
  throw new Error(`${label} failed after retries.`);
}

async function pollFalResult(model: string, requestId: string, falKey: string): Promise<unknown> {
  const statusUrl = `${FAL_QUEUE_BASE}/${model}/requests/${requestId}/status`;
  const resultUrl = `${FAL_QUEUE_BASE}/${model}/requests/${requestId}`;

  for (let i = 0; i < 45; i++) {
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${falKey}` },
      cache: "no-store",
    });
    if (!statusRes.ok) {
      const body = await statusRes.text();
      throw new Error(`Fal status failed (${statusRes.status}): ${body.slice(0, 240)}`);
    }
    const status = (await statusRes.json()) as { status?: string };
    if (status.status === "COMPLETED") {
      const resultRes = await fetch(resultUrl, {
        headers: { Authorization: `Key ${falKey}` },
        cache: "no-store",
      });
      if (!resultRes.ok) {
        const body = await resultRes.text();
        throw new Error(`Fal result failed (${resultRes.status}): ${body.slice(0, 240)}`);
      }
      return resultRes.json();
    }
    if (status.status === "FAILED") {
      throw new Error("Fal request failed.");
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error("Fal request timed out.");
}

async function runFalModel(model: string, input: Record<string, unknown>): Promise<unknown> {
  const falKey = requireEnv("FAL_KEY");
  const res = await fetch(`${FAL_QUEUE_BASE}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fal enqueue failed (${res.status}): ${body.slice(0, 280)}`);
  }
  const payload = (await res.json()) as { request_id?: string; status?: string };
  if (payload.request_id) {
    return pollFalResult(model, payload.request_id, falKey);
  }
  return payload;
}

async function runNanoBananaTurnaround(
  masterHeadshotUrl: string | null,
  turnaroundPrompt: string,
  categoryDescription?: string,
  modelCandidates: readonly string[] = [FLOW_MODEL_PRO],
): Promise<string | null> {
  const webhook = process.env.GOOGLE_FLOW_WEBHOOK_URL?.trim();
  if (!webhook) {
    const prompt = masterHeadshotUrl
      ? `${REFERENCE_SHEET_RULES}\n\nCharacter direction: ${turnaroundPrompt}`
      : NO_REFERENCE_SHEET_RULES.replace(
          "[PUT YOUR CHARACTER DESCRIPTION HERE]",
          categoryDescription || turnaroundPrompt,
        );
    const urls = await runGoogleDirectImages(prompt, 1, modelCandidates);
    return urls[0] ?? null;
  }

  const apiKey = process.env.GOOGLE_FLOW_API_KEY?.trim();
  let lastError = "Google Flow turnaround failed.";
  for (const model of modelCandidates) {
    const res = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(
        masterHeadshotUrl
          ? {
              model,
              input: {
                reference_image_url: masterHeadshotUrl,
                prompt: `${REFERENCE_SHEET_RULES}\n\nCharacter direction: ${turnaroundPrompt}`,
              },
            }
          : {
              model,
              input: {
                prompt: NO_REFERENCE_SHEET_RULES.replace(
                  "[PUT YOUR CHARACTER DESCRIPTION HERE]",
                  categoryDescription || turnaroundPrompt,
                ),
              },
            },
      ),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      lastError = `Google Flow turnaround failed on ${model} (${res.status}): ${body.slice(0, 240)}`;
      continue;
    }
    const payload = (await res.json()) as {
      image_url?: string;
      output?: string[] | string;
      images?: Array<{ url?: string }>;
    };
    if (payload.image_url && /^https?:\/\//i.test(payload.image_url)) {
      return payload.image_url;
    }
    const urls = extractImageUrls(payload);
    if (urls[0]) return urls[0];
    lastError = `Google Flow turnaround returned no images on ${model}.`;
  }
  throw new Error(lastError);
}

async function scoreImageUrl(url: string | null): Promise<number> {
  if (!url || !/^https?:\/\//i.test(url)) return -1;
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (!res.ok) return 0;
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const contentLength = Number.parseInt(res.headers.get("content-length") || "0", 10);
    let score = 0;
    if (contentType.startsWith("image/")) score += 5;
    if (contentLength > 0) {
      // Prefer richer files up to a sane cap.
      score += Math.min(50, Math.floor(contentLength / 120000));
    }
    return score;
  } catch {
    return 0;
  }
}

async function pickBestTurnaroundCandidate(
  referenceBasedUrl: string | null,
  noReferenceUrl: string | null,
): Promise<string | null> {
  const [refScore, noRefScore] = await Promise.all([
    scoreImageUrl(referenceBasedUrl),
    scoreImageUrl(noReferenceUrl),
  ]);
  if (refScore < 0 && noRefScore < 0) return null;
  return refScore >= noRefScore ? referenceBasedUrl : noReferenceUrl;
}

async function runFlowHeadshots(
  visualPrompt: string,
  count: number,
  modelCandidates: readonly string[] = [FLOW_MODEL_PRO],
): Promise<string[]> {
  const webhook = process.env.GOOGLE_FLOW_WEBHOOK_URL?.trim();
  if (!webhook) {
    const urls = await runGoogleDirectImages(
      `${visualPrompt}. Generate consistent 9:16 headshots of the same person.`,
      count,
      modelCandidates,
    );
    return urls;
  }
  const apiKey = process.env.GOOGLE_FLOW_API_KEY?.trim();
  let lastError = "Google Flow headshots failed.";
  for (const model of modelCandidates) {
    const res = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        input: {
          task: "headshots",
          count,
          prompt: `${visualPrompt}. Generate consistent 9:16 headshots of the same person.`,
        },
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      lastError = `Google Flow headshots failed on ${model} (${res.status}): ${body.slice(0, 240)}`;
      continue;
    }
    const payload = await res.json();
    const urls = extractImageUrls(payload).slice(0, count);
    if (urls.length > 0) return urls;
    lastError = `Google Flow headshots returned no URLs on ${model}.`;
  }
  throw new Error(lastError);
}

function categoryDescriptionFromProfile(profile: ExpandedCharacter): string {
  const lines = [
    `Character Name: ${profile.stage_name || profile.name}`,
    `Age Range: ${profile.age_range || "N/A"}`,
    `Role/Archetype: ${profile.role_archetype || profile.personality_archetype || "N/A"}`,
    `Origin City: ${profile.origin_city || "N/A"}`,
    `Visual Style: ${profile.visual_prompt || "N/A"}`,
    `Mood/Tone: ${profile.mood_tone || profile.tags.join(", ") || "N/A"}`,
    `Must-Keep Traits: ${profile.must_keep_traits || profile.turnaround_prompt || "N/A"}`,
    `Primary Goal: ${profile.primary_goal || "N/A"}`,
    `Core Wound: ${profile.core_wound || "N/A"}`,
    `Fatal Flaw: ${profile.fatal_flaw || "N/A"}`,
    `Backstory Summary: ${profile.backstory_summary || "N/A"}`,
    `Signature Style: ${profile.signature_style || "N/A"}`,
    `Market Segment: ${profile.market_segment || "N/A"}`,
  ];
  return lines.join("\n");
}

export async function runCharacterAutomation(
  seedPrompt: string,
  providers: AutomationProviderConfig = {
    headshotProvider: "flow",
    turnaroundProvider: "nano-banana",
    qualityMode: "studio",
  },
): Promise<AutomatedCharacterDraft> {
  let profile: ExpandedCharacter;
  try {
    profile = await expandSeedPrompt(seedPrompt);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    const resourceExhausted =
      /RESOURCE_EXHAUSTED|credits are depleted|prepayment credits/i.test(message);
    if (!resourceExhausted) {
      throw e;
    }
    // Graceful degradation: keep creation flow alive when Gemini billing is exhausted.
    profile = fallbackProfileFromSeed(seedPrompt);
  }

  const headshotModelCandidates = [FLOW_MODEL_PRO] as const;
  const turnaroundModelCandidates = [FLOW_MODEL_PRO] as const;

  let headshots: string[] = [];
  let turnaroundUrl: string | null = null;
  let masterHeadshot: string | null = null;
  const allowFalFallback = false;

  async function generateViaFluxFallback() {
    const masterRaw = await withRetries(
      "Flux master headshot",
      async (attempt) =>
        runFalModel(FAL_FLUX_MODEL, {
          prompt:
            attempt > 1
              ? `${profile.visual_prompt}. Keep same identity and realistic anatomy.`
              : profile.visual_prompt,
          image_size: "portrait_9_16",
        }),
      (payload) => normalizeHttpUrls(extractImageUrls(payload)).length >= 1,
    );
    masterHeadshot = normalizeHttpUrls(extractImageUrls(masterRaw))[0];
    if (!masterHeadshot) {
      throw new Error("Flux did not return a master headshot URL.");
    }
    const consistencyRaw = await withRetries(
      "Fal consistency set",
      async (attempt) =>
        runFalModel(FAL_INSTANT_CHARACTER_MODEL, {
          image_url: masterHeadshot,
          prompt:
            attempt > 1
              ? `${profile.visual_prompt}. Enforce strict same-face identity across outputs.`
              : profile.visual_prompt,
          turnaround_prompt: profile.turnaround_prompt,
          num_images: 4,
        }),
      (payload) => normalizeHttpUrls(extractImageUrls(payload)).length >= 4,
    );
    const generated = normalizeHttpUrls(extractImageUrls(consistencyRaw));
    headshots = (generated.length ? generated : [masterHeadshot]).slice(0, 4);
    turnaroundUrl = generated[4] ?? null;
  }

  if (providers.headshotProvider === "flow") {
    try {
      headshots = await withRetries(
        "Flow headshots",
        async (attempt) => {
          const reinforcement =
            attempt > 1
              ? "Prior attempt had inconsistency. Preserve exact same identity in all shots."
              : "";
          const urls = await runFlowHeadshots(
            `${profile.visual_prompt} ${reinforcement}`.trim(),
            4,
            headshotModelCandidates,
          );
          return normalizeHttpUrls(urls);
        },
        (urls) => urls.length >= 4,
      );
      masterHeadshot = headshots[0] ?? null;
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      const exhausted = /RESOURCE_EXHAUSTED|credits are depleted|prepayment credits/i.test(
        message,
      );
      if (!exhausted) throw e;
      throw new Error(
        "Nano Banana Pro generation quota exhausted. Fal/Flux fallback is disabled. Use Bridge mode (paste 4 headshot URLs + 1 turnaround URL) or restore Google image quota.",
      );
    }
  } else {
    throw new Error(
      "Only Nano Banana Pro is allowed in this environment. Set provider to Flow/Nano Banana Pro.",
    );
  }

  if (providers.turnaroundProvider === "nano-banana") {
    const flowTurnaroundWithReference = await withRetries(
      "Nano Banana turnaround",
      async (attempt) =>
        runNanoBananaTurnaround(
          masterHeadshot,
          attempt > 1
            ? `${profile.turnaround_prompt}. Fix identity drift and keep exact facial proportions.`
            : profile.turnaround_prompt,
          categoryDescriptionFromProfile(profile),
          turnaroundModelCandidates,
        ),
      (url) => Boolean(url && /^https?:\/\//i.test(url)),
    );
    // Also test no-reference mode and keep whichever candidate appears stronger.
    const flowTurnaroundNoReference = await withRetries(
      "Nano Banana turnaround (no-reference)",
      async (attempt) =>
        runNanoBananaTurnaround(
          null,
          attempt > 1
            ? `${profile.turnaround_prompt}. Fix panel consistency and maintain same identity in all views.`
            : profile.turnaround_prompt,
          categoryDescriptionFromProfile(profile),
          turnaroundModelCandidates,
        ),
      (url) => Boolean(url && /^https?:\/\//i.test(url)),
    );
    const best = await pickBestTurnaroundCandidate(
      flowTurnaroundWithReference,
      flowTurnaroundNoReference,
    );
    turnaroundUrl = best ?? turnaroundUrl;
  } else if (!turnaroundUrl && masterHeadshot) {
    const consistencyRaw = await withRetries(
      "Fal turnaround fallback",
      async (attempt) =>
        runFalModel(FAL_INSTANT_CHARACTER_MODEL, {
          image_url: masterHeadshot,
          prompt: profile.visual_prompt,
          turnaround_prompt:
            attempt > 1
              ? `${profile.turnaround_prompt}. Keep exact same identity and body proportions.`
              : profile.turnaround_prompt,
          num_images: 1,
        }),
      (payload) => normalizeHttpUrls(extractImageUrls(payload)).length >= 1,
    );
    turnaroundUrl = normalizeHttpUrls(extractImageUrls(consistencyRaw))[0] ?? null;
  }

  headshots = normalizeHttpUrls(headshots).slice(0, 4);
  if (headshots.length < 4) {
    throw new Error(
      `Self-correct guardrail: expected 4 headshots, received ${headshots.length}.`,
    );
  }
  if (!turnaroundUrl || !/^https?:\/\//i.test(turnaroundUrl)) {
    throw new Error("Self-correct guardrail: turnaround sheet missing after retries.");
  }

  return { profile, headshots, turnaroundUrl };
}
