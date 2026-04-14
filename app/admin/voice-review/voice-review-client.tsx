"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import {
  approveSuggestedElevenlabsVoiceAction,
  dismissSuggestedElevenlabsVoiceAction,
  markProductionElevenlabsVoiceReviewedAction,
} from "./actions";
import type { ElevenlabsVoiceBriefSource } from "@/lib/elevenlabs-voice-brief";
import { buildElevenlabsVoiceMatchingBrief } from "@/lib/elevenlabs-voice-brief";
import {
  elevenlabsDocsUrl,
  elevenlabsPreviewUsageNote,
  elevenlabsVoiceLabUrl,
  elevenlabsVoiceLibraryUrl,
} from "@/lib/elevenlabs-links";

export type VoiceReviewRow = ElevenlabsVoiceBriefSource & {
  id: string;
  levellabs_speech_id: string | null;
  elevenlabs_voice_suggested_id: string | null;
  elevenlabs_voice_approved_at: string | null;
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function VoiceReviewClient({ initialRows }: { initialRows: VoiceReviewRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyBrief = useCallback(async (row: VoiceReviewRow) => {
    const text = buildElevenlabsVoiceMatchingBrief(row);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(row.id);
      setTimeout(() => setCopiedId((id) => (id === row.id ? null : id)), 2500);
    } catch {
      setCopiedId(null);
    }
  }, []);

  if (rows.length === 0) {
    return (
      <p className="rounded-sm border border-white/15 bg-black/35 px-4 py-3 text-sm text-white/60">
        No characters have a <strong className="text-white/80">suggested</strong> ElevenLabs voice id
        in the queue yet (that is normal if you skipped <code className="text-white/70">29.txt</code> — it is
        optional). When you add one via import or casting, it will appear here. Bulk import maps{" "}
        <code className="text-white/70">29.txt</code> to the suggestion field when you include it.{" "}
        <Link href="/admin/actor-pipeline" className="text-metallic-orange underline-offset-2 hover:underline">
          Actor pipeline
        </Link>{" "}
        To build a voice brief before you have a suggestion, open any character on the{" "}
        <Link href="/admin/cast" className="text-metallic-orange underline-offset-2 hover:underline">
          casting form
        </Link>{" "}
        and use <strong className="text-white/75">Copy voice-matching brief for ElevenLabs</strong>.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">
        Open ElevenLabs to audition ids before you approve. Production id is{" "}
        <code className="text-white/60">levellabs_speech_id</code> (optional until you are ready;{" "}
        <code className="text-white/60">29.txt</code> imports fill{" "}
        <code className="text-white/60">elevenlabs_voice_suggested_id</code> when you included a suggested
        id).
      </p>
      <p className="text-xs text-white/40">{elevenlabsPreviewUsageNote}</p>
      <p className="text-xs text-white/45">
        Optional server env for a future “brief → suggested voice id” API:{" "}
        <code className="text-white/55">ELEVENLABS_API_KEY</code> (see{" "}
        <code className="text-white/55">.env.example</code>). Until then, copy brief → ElevenLabs → copy
        id → approve here.
      </p>

      {msg ? <p className="text-sm text-metallic-orange/90">{msg}</p> : null}
      {err ? (
        <p className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </p>
      ) : null}

      <ul className="space-y-4">
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded-sm border border-white/12 bg-black/35 p-4 text-sm text-white/75"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{r.name}</p>
                <p className="text-xs text-white/45">
                  pack: {r.pack_name?.trim() || "—"} · approved: {fmtWhen(r.elevenlabs_voice_approved_at)}
                </p>
              </div>
              <Link
                href={`/admin/cast?edit=${encodeURIComponent(r.id)}`}
                className="text-xs text-metallic-orange underline-offset-2 hover:underline"
              >
                Casting form
              </Link>
            </div>

            {r.speech?.trim() ? (
              <p className="mt-2 text-xs text-white/50">
                <span className="text-white/40">Speech notes:</span> {r.speech.trim().slice(0, 280)}
                {r.speech.trim().length > 280 ? "…" : ""}
              </p>
            ) : null}

            <div className="mt-2">
              <button
                type="button"
                onClick={() => void copyBrief(r)}
                className="rounded-sm border border-metallic-orange/40 bg-metallic-orange/10 px-3 py-1.5 text-xs font-medium text-metallic-orange hover:bg-metallic-orange/20"
              >
                {copiedId === r.id ? "Copied brief" : "Copy voice-matching brief for ElevenLabs"}
              </button>
            </div>

            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-sm border border-white/10 bg-black/40 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-metallic-orange/90">
                  Suggested (AI / 29.txt)
                </p>
                <code className="mt-1 block break-all text-white/80">
                  {r.elevenlabs_voice_suggested_id?.trim() || "—"}
                </code>
                {r.elevenlabs_voice_suggested_id?.trim() ? (
                  <a
                    href={elevenlabsVoiceLabUrl(r.elevenlabs_voice_suggested_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-metallic-orange underline-offset-2 hover:underline"
                  >
                    Open in ElevenLabs
                  </a>
                ) : null}
              </div>
              <div className="rounded-sm border border-white/10 bg-black/40 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-metallic-orange/90">
                  Production voice id
                </p>
                <code className="mt-1 block break-all text-white/80">
                  {r.levellabs_speech_id?.trim() || "—"}
                </code>
                {r.levellabs_speech_id?.trim() ? (
                  <a
                    href={elevenlabsVoiceLabUrl(r.levellabs_speech_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-metallic-orange underline-offset-2 hover:underline"
                  >
                    Open in ElevenLabs
                  </a>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || !r.elevenlabs_voice_suggested_id?.trim()}
                onClick={() => {
                  setErr(null);
                  setMsg(null);
                  startTransition(async () => {
                    const res = await approveSuggestedElevenlabsVoiceAction(r.id);
                    if (!res.ok) {
                      setErr(res.error);
                      return;
                    }
                    const sid = r.elevenlabs_voice_suggested_id?.trim() ?? null;
                    setMsg("Approved suggested → production");
                    setRows((prev) =>
                      prev.map((x) =>
                        x.id === r.id
                          ? {
                              ...x,
                              levellabs_speech_id: sid,
                              elevenlabs_voice_approved_at: new Date().toISOString(),
                            }
                          : x,
                      ),
                    );
                  });
                }}
                className="rounded-sm bg-metallic-orange px-3 py-1.5 text-xs font-semibold text-black hover:bg-metallic-orange/90 disabled:opacity-40"
              >
                Approve suggested → production
              </button>
              <button
                type="button"
                disabled={pending || !r.elevenlabs_voice_suggested_id?.trim()}
                onClick={() => {
                  setErr(null);
                  setMsg(null);
                  startTransition(async () => {
                    const res = await dismissSuggestedElevenlabsVoiceAction(r.id);
                    if (!res.ok) {
                      setErr(res.error);
                      return;
                    }
                    setMsg("Dismissed suggestion");
                    setRows((prev) => prev.filter((x) => x.id !== r.id));
                  });
                }}
                className="rounded-sm border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:border-metallic-orange/40"
              >
                Dismiss suggestion
              </button>
              <button
                type="button"
                disabled={pending || !r.levellabs_speech_id?.trim()}
                onClick={() => {
                  setErr(null);
                  setMsg(null);
                  startTransition(async () => {
                    const res = await markProductionElevenlabsVoiceReviewedAction(r.id);
                    if (!res.ok) {
                      setErr(res.error);
                      return;
                    }
                    setMsg("Marked production id reviewed");
                    setRows((prev) =>
                      prev.map((x) =>
                        x.id === r.id
                          ? { ...x, elevenlabs_voice_approved_at: new Date().toISOString() }
                          : x,
                      ),
                    );
                  });
                }}
                className="rounded-sm border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:border-metallic-orange/40"
              >
                Mark production id reviewed
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-white/40">
        <a
          href={elevenlabsVoiceLibraryUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="text-metallic-orange underline-offset-2 hover:underline"
        >
          ElevenLabs Voice Library
        </a>
        {" · "}
        <a
          href={elevenlabsDocsUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="text-metallic-orange underline-offset-2 hover:underline"
        >
          Docs &amp; API terms
        </a>
      </p>
    </div>
  );
}
