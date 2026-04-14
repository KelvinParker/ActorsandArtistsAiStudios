"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { ActorRow } from "@/lib/types/actor";

type Props = { actorId: string; actor: ActorRow };

export function ActorDnaLoraPanel({ actorId, actor }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const runStart = useCallback(() => {
    setError(null);
    setMessage(null);
    start(async () => {
      const res = await fetch(`/api/admin/actors/${actorId}/dna-lora/start`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setError(j.error ?? `Start failed (${res.status})`);
        return;
      }
      setMessage(j.message ?? "Training queued. Use “Check Fal status” until completed.");
      router.refresh();
    });
  }, [actorId, router]);

  const runSync = useCallback(() => {
    setError(null);
    setMessage(null);
    start(async () => {
      const res = await fetch(`/api/admin/actors/${actorId}/dna-lora/sync`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        status?: string;
        dna_lora_url?: string;
      };
      if (!res.ok) {
        setError(j.error ?? `Sync failed (${res.status})`);
        return;
      }
      if (j.ok === false && j.status === "failed") {
        setError(j.error ?? "Fal reported failure.");
        return;
      }
      if (j.status === "completed" && j.dna_lora_url) {
        setMessage("Training completed. LoRA URL saved on this actor.");
        router.refresh();
        return;
      }
      setMessage("Still processing on Fal — try again in a minute.");
      router.refresh();
    });
  }, [actorId, router]);

  const status = actor.dna_lora_status?.trim() || "—";
  const trigger = actor.dna_lora_trigger?.trim() || "—";
  const loraUrl = actor.dna_lora_url?.trim() || "";
  const falReq = actor.dna_lora_fal_request_id?.trim() || "—";
  const lastErr = actor.dna_lora_error?.trim();

  return (
    <section
      aria-label="DNA LoRA training"
      className="mt-10 border-t border-white/10 pt-10"
    >
      <h2 className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.28em] text-metallic-orange md:text-sm">
        DNA LoRA (Fal)
      </h2>
      <p className="mx-auto mb-6 max-w-2xl text-center text-xs leading-relaxed text-white/45">
        Train a Flux LoRA from this character&apos;s headshots + turnaround via{" "}
        <code className="text-white/55">fal-ai/flux-lora-general-training</code>. Requires{" "}
        <code className="text-white/55">FAL_KEY</code> and public image URLs Fal can fetch.
        With <code className="text-white/55">NEXT_PUBLIC_APP_URL</code> +{" "}
        <code className="text-white/55">FAL_WEBHOOK_SECRET</code>, Fal calls{" "}
        <code className="text-white/55">/api/webhooks/fal</code> when training finishes. Otherwise
        use <strong className="text-white/70">Check Fal status</strong> until completed (often
        several minutes).
      </p>

      <div className="mx-auto max-w-2xl space-y-4 rounded-sm border border-white/10 bg-black/35 p-4 text-left text-[11px] text-white/70">
        <div className="grid gap-1 sm:grid-cols-2">
          <p>
            <span className="text-white/45">Status:</span>{" "}
            <span className="font-medium text-white/85">{status}</span>
          </p>
          <p>
            <span className="text-white/45">Fal request:</span>{" "}
            <span className="break-all font-mono text-[10px] text-white/75">{falReq}</span>
          </p>
          <p className="sm:col-span-2">
            <span className="text-white/45">Trigger:</span>{" "}
            <span className="break-all font-mono text-[10px] text-metallic-orange/90">
              {trigger}
            </span>
          </p>
          {lastErr ? (
            <p className="sm:col-span-2 text-red-300/90">
              <span className="text-white/45">Last error:</span> {lastErr}
            </p>
          ) : null}
        </div>

        {loraUrl ? (
          <div>
            <span className="text-white/45">dna_lora_url:</span>
            <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-[10px] text-white/80">
              {loraUrl}
            </pre>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={runStart}
            className="rounded-sm border border-metallic-orange/50 bg-metallic-orange/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-metallic-orange transition hover:bg-metallic-orange/25 disabled:opacity-40"
          >
            Start Fal training
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={runSync}
            className="rounded-sm border border-white/25 bg-black/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/85 transition hover:border-metallic-orange/45 hover:text-metallic-orange disabled:opacity-40"
          >
            Check Fal status
          </button>
        </div>

        {message ? (
          <p className="text-emerald-200/90" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="text-red-300/90" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
