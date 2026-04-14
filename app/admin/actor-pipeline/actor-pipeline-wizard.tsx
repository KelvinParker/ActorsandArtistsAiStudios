"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AI_FOLDER_CONTRACT_PROMPT, FOLDER_TREE_EXAMPLE } from "@/lib/actor-pipeline-prompts";
import { parseActorLibraryZip, type ParsedActorLibraryGroup } from "@/lib/parse-actor-library";
import { postActorLibraryImport, type ActorLibraryImportJob } from "@/lib/post-actor-library-import";
import { classifyActorImportImages } from "@/lib/classify-actor-import-images";

const inputClass =
  "mt-1 w-full rounded-sm border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-metallic-orange/50 focus:outline-none focus:ring-1 focus:ring-metallic-orange/30";
const labelClass = "block text-xs font-medium uppercase tracking-wider text-metallic-orange/90";

type ActorReviewState = {
  inheritedPack: string | null;
  files: Record<string, string>;
  rawImages: { relWithinActor: string; file: File }[];
  turnaround: File | null;
  headshots: File[];
};

function groupsToReviewStates(groups: Map<string, ParsedActorLibraryGroup>): ActorReviewState[] {
  return Array.from(groups.values())
    .filter((g) => g.files.size > 0)
    .map((g) => {
      const classified = classifyActorImportImages(g.rawImages);
      const rec: Record<string, string> = {};
      for (const [n, t] of g.files) {
        rec[String(n)] = t;
      }
      return {
        inheritedPack: g.inheritedPack,
        files: rec,
        rawImages: g.rawImages,
        turnaround: classified.turnaround,
        headshots: classified.headshots,
      };
    });
}

function jobsFromReview(states: ActorReviewState[]): ActorLibraryImportJob[] {
  return states.map((s) => ({
    inheritedPack: s.inheritedPack,
    files: s.files,
    classified: { turnaround: s.turnaround, headshots: s.headshots },
  }));
}

function actorDisplayName(files: Record<string, string>): string {
  const n = files["1"]?.trim();
  return n || "(missing 1.txt — name)";
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      setDone(false);
    }
  }, [text]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={labelClass}>{label}</span>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-sm border border-metallic-orange/40 bg-metallic-orange/10 px-3 py-1 text-xs font-medium text-metallic-orange transition hover:bg-metallic-orange/20"
        >
          {done ? "Copied" : "Copy"}
        </button>
      </div>
      <textarea
        readOnly
        value={text}
        rows={Math.min(18, 4 + text.split("\n").length)}
        className="w-full resize-y rounded-sm border border-white/15 bg-black/60 p-3 font-mono text-[11px] leading-relaxed text-white/80"
      />
    </div>
  );
}

function Thumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return <div className="h-20 w-14 animate-pulse rounded-sm bg-white/10" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-20 w-14 rounded-sm object-cover ring-1 ring-white/15" />
  );
}

export function ActorPipelineWizard() {
  const router = useRouter();
  const [defaultPack, setDefaultPack] = useState("");
  const [reviewStates, setReviewStates] = useState<ActorReviewState[] | null>(null);
  const [assignMode, setAssignMode] = useState<Record<number, "turnaround" | "headshot">>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadZip = useCallback(
    async (file: File) => {
      setError(null);
      setStatus("Reading zip…");
      try {
        const groups = await parseActorLibraryZip(file, defaultPack);
        const states = groupsToReviewStates(groups);
        if (states.length === 0) {
          setReviewStates(null);
          setError("No actors found (need at least 1.txt … per actor folder).");
          setStatus(null);
          return;
        }
        setReviewStates(states);
        setAssignMode(Object.fromEntries(states.map((_, i) => [i, "headshot" as const])));
        setStatus(`Loaded ${states.length} actor(s). Review images below, then import.`);
      } catch (e) {
        setReviewStates(null);
        setError(e instanceof Error ? e.message : "Zip read failed");
        setStatus(null);
      }
    },
    [defaultPack],
  );

  const onZipPick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await loadZip(file);
      e.target.value = "";
    },
    [loadZip],
  );

  const onDropZip = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = Array.from(e.dataTransfer.files).find((f) => /\.zip$/i.test(f.name));
      if (!file) {
        setError("Drop a .zip file.");
        return;
      }
      await loadZip(file);
    },
    [loadZip],
  );

  const setMode = useCallback((actorIndex: number, mode: "turnaround" | "headshot") => {
    setAssignMode((m) => ({ ...m, [actorIndex]: mode }));
  }, []);

  const onImageClick = useCallback((actorIndex: number, file: File, mode: "turnaround" | "headshot") => {
    setReviewStates((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const s = { ...next[actorIndex] };

      if (mode === "turnaround") {
        s.turnaround = s.turnaround === file ? null : file;
        s.headshots = s.headshots.filter((h) => h !== file);
      } else {
        const idx = s.headshots.findIndex((h) => h === file);
        if (idx >= 0) {
          s.headshots = s.headshots.filter((h) => h !== file);
        } else if (s.headshots.length < 5) {
          s.headshots = [...s.headshots, file];
        }
        if (s.turnaround === file) s.turnaround = null;
      }
      next[actorIndex] = s;
      return next;
    });
  }, []);

  const resetAuto = useCallback((actorIndex: number) => {
    setReviewStates((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const s = { ...next[actorIndex] };
      const c = classifyActorImportImages(s.rawImages);
      s.turnaround = c.turnaround;
      s.headshots = c.headshots;
      next[actorIndex] = s;
      return next;
    });
  }, []);

  const runImport = useCallback(() => {
    if (!reviewStates?.length) return;
    setError(null);
    setStatus("Importing…");
    startTransition(async () => {
      const res = await postActorLibraryImport(jobsFromReview(reviewStates));
      if (!res.ok) {
        setError(res.error);
        setStatus(null);
        return;
      }
      setStatus(`Done: ${res.inserted} inserted, ${res.updated} updated.`);
      router.refresh();
    });
  }, [reviewStates, router]);

  const textPreviewLines = useCallback((files: Record<string, string>) => {
    const nums = Object.keys(files)
      .map((k) => Number.parseInt(k, 10))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    return nums.map((n) => {
      const body = files[String(n)] ?? "";
      const one = body.trim().split(/\n+/)[0] ?? "";
      const short = one.length > 120 ? `${one.slice(0, 120)}…` : one;
      return `${n}.txt: ${short || "(empty)"}`;
    });
  }, []);

  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-metallic-orange">
          1. AI output (Gemini / ChatGPT / image tool)
        </h2>
        <p className="max-w-3xl text-sm text-white/60">
          Use your generator outside this app, then save results as a zip that matches our folder
          contract. Paste the block below into the AI as instructions. When you are happy with the
          folder on disk, zip it and continue to step 2.
        </p>
        <CopyBlock label="Folder + field contract (paste into AI)" text={AI_FOLDER_CONTRACT_PROMPT} />
        <CopyBlock label="Example tree (optional second message)" text={FOLDER_TREE_EXAMPLE} />
        <p className="text-xs text-white/45">
          Canonical field list: <code className="text-white/60">lib/actor-import-field-map.json</code>.
          Gemini / LLM field table + rules:{" "}
          <code className="text-white/60">docs/gemini-actor-folder-fields.md</code>. Human-readable notes:{" "}
          <code className="text-white/60">scripts/actor-folder-import/README.md</code>. After import, if you
          used <code className="text-white/60">29.txt</code> for an ElevenLabs id, open{" "}
          <Link href="/admin/voice-review" className="text-metallic-orange underline-offset-2 hover:underline">
            Voice review
          </Link>{" "}
          to approve it into production.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-metallic-orange">
          2. Load zip → pick turnaround & headshots → import
        </h2>
        <p className="max-w-3xl text-sm text-white/60">
          Text from <code className="text-white/70">1.txt</code>–<code className="text-white/70">33.txt</code> is
          read automatically. Click each thumbnail to assign: in{" "}
          <strong className="text-white/80">Headshot</strong> mode, each click adds or removes a slot (up to
          five, order = click order). In <strong className="text-white/80">Turnaround</strong> mode, click one
          image for the sheet (click again to clear). Then import to Supabase (same pipeline as{" "}
          <Link href="/admin/import-actors" className="text-metallic-orange underline-offset-2 hover:underline">
            fast import
          </Link>
          ).
        </p>

        <div>
          <label htmlFor="pipeline-default-pack" className={labelClass}>
            Default pack name (only if paths are ActorName/… without a pack parent)
          </label>
          <input
            id="pipeline-default-pack"
            type="text"
            value={defaultPack}
            onChange={(e) => setDefaultPack(e.target.value)}
            className={inputClass}
            placeholder="e.g. Gemini Batch — April 2026"
          />
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={onDropZip}
          className="rounded-sm border border-dashed border-metallic-orange/35 bg-metallic-orange/5 p-6 text-center"
        >
          <p className="text-sm font-semibold text-metallic-orange">Drop review zip here</p>
          <p className="mt-2 text-xs text-white/45">Pack / ActorFolder / 1.txt + images</p>
        </div>
        <div>
          <label htmlFor="pipeline-zip" className={labelClass}>
            Or choose .zip
          </label>
          <input
            id="pipeline-zip"
            type="file"
            accept=".zip,application/zip"
            disabled={pending}
            onChange={onZipPick}
            className="mt-2 block w-full text-sm text-white/70 file:mr-3 file:cursor-pointer file:rounded-sm file:border file:border-white/20 file:bg-black/50 file:px-3 file:py-2 file:text-white/90 hover:file:border-metallic-orange/40"
          />
        </div>
      </section>

      {reviewStates && reviewStates.length > 0 ? (
        <section className="space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-metallic-orange">
            3. Review ({reviewStates.length} actor{reviewStates.length === 1 ? "" : "s"})
          </h2>

          {reviewStates.map((s, i) => (
            <div key={`actor-review-${i}`} className="rounded-sm border border-white/12 bg-black/35 p-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-white">{actorDisplayName(s.files)}</p>
                  <p className="text-xs text-white/45">
                    pack:{" "}
                    <span className="text-white/65">{s.inheritedPack?.trim() || "(none)"}</span> ·{" "}
                    {s.rawImages.length} image(s)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => resetAuto(i)}
                  className="rounded-sm border border-white/20 px-2 py-1 text-xs text-white/70 hover:border-metallic-orange/40 hover:text-white"
                >
                  Reset image auto-detect
                </button>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                <span className="text-xs text-white/50">Assign mode:</span>
                <button
                  type="button"
                  onClick={() => setMode(i, "headshot")}
                  className={`rounded-sm px-2 py-1 text-xs font-medium ${
                    (assignMode[i] ?? "headshot") === "headshot"
                      ? "bg-metallic-orange/25 text-metallic-orange"
                      : "border border-white/15 text-white/60"
                  }`}
                >
                  Headshots (click up to 5)
                </button>
                <button
                  type="button"
                  onClick={() => setMode(i, "turnaround")}
                  className={`rounded-sm px-2 py-1 text-xs font-medium ${
                    assignMode[i] === "turnaround"
                      ? "bg-metallic-orange/25 text-metallic-orange"
                      : "border border-white/15 text-white/60"
                  }`}
                >
                  Turnaround (one)
                </button>
              </div>

              <p className="mb-2 text-xs text-white/45">
                Turnaround: {s.turnaround ? s.turnaround.name : "—"} · Headshots ({s.headshots.length}/5):{" "}
                {s.headshots.length ? s.headshots.map((h) => h.name).join(", ") : "—"}
              </p>

              <div className="mb-4 flex flex-wrap gap-2">
                {s.rawImages.map((r, j) => {
                  const isT = s.turnaround === r.file;
                  const hi = s.headshots.findIndex((h) => h === r.file);
                  const isH = hi >= 0;
                  return (
                    <button
                      key={`${r.relWithinActor}-${j}`}
                      type="button"
                      onClick={() => onImageClick(i, r.file, assignMode[i] ?? "headshot")}
                      className={`rounded-sm p-1 text-left transition ${
                        isT
                          ? "ring-2 ring-metallic-orange"
                          : isH
                            ? "ring-2 ring-white/50"
                            : "ring-1 ring-white/10 hover:ring-metallic-orange/40"
                      }`}
                    >
                      <Thumb file={r.file} />
                      <span className="mt-1 block max-w-[5.5rem] truncate text-[10px] text-white/50">
                        {r.relWithinActor}
                      </span>
                      {isH ? (
                        <span className="block text-[10px] text-metallic-orange">H{hi + 1}</span>
                      ) : null}
                      {isT ? <span className="block text-[10px] text-metallic-orange">T</span> : null}
                    </button>
                  );
                })}
              </div>

              <details className="text-xs text-white/55">
                <summary className="cursor-pointer text-white/70">Text fields (auto from .txt)</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-sm border border-white/10 bg-black/50 p-2 font-mono text-[10px] leading-relaxed">
                  {textPreviewLines(s.files).join("\n")}
                </pre>
              </details>
            </div>
          ))}

          <button
            type="button"
            disabled={pending}
            onClick={runImport}
            className="rounded-sm bg-metallic-orange px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-metallic-orange/90 disabled:opacity-40"
          >
            {pending ? "Importing…" : "Import all to Supabase"}
          </button>
        </section>
      ) : null}

      {status ? (
        <p className="text-sm text-metallic-orange/90" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p
          className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
