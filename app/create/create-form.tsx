"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCharacterAction } from "./actions";

const inputClass =
  "mt-1 w-full rounded-sm border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-metallic-orange/50 focus:outline-none focus:ring-1 focus:ring-metallic-orange/30";
const labelClass = "block text-xs font-medium uppercase tracking-wider text-metallic-orange/90";

export function CreateCharacterForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [imageSourceMode, setImageSourceMode] = useState<"bridge" | "auto">("bridge");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createCharacterAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/actors/${result.actorId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label htmlFor="seed_prompt" className={labelClass}>
          Character seed prompt
        </label>
        <textarea
          id="seed_prompt"
          name="seed_prompt"
          required
          rows={4}
          className={inputClass}
          placeholder="Describe your character concept, tone, and world."
        />
      </div>

      <div>
        <label htmlFor="name_override" className={labelClass}>
          Optional name override
        </label>
        <input
          id="name_override"
          name="name_override"
          className={inputClass}
          placeholder="Leave blank to use AI-generated name"
        />
      </div>

      <div>
        <label htmlFor="tags" className={labelClass}>
          Optional extra tags
        </label>
        <input
          id="tags"
          name="tags"
          className={inputClass}
          placeholder="Comma-separated tags"
        />
      </div>

      <div>
        <label htmlFor="visibility" className={labelClass}>
          Visibility
        </label>
        <select id="visibility" name="visibility" className={inputClass} defaultValue="public">
          <option value="public">Public gallery</option>
          <option value="private">Private (future filters)</option>
        </select>
      </div>

      <div>
        <label htmlFor="quality_mode" className={labelClass}>
          Quality mode
        </label>
        <select id="quality_mode" name="quality_mode" className={inputClass} defaultValue="studio">
          <option value="studio">Studio (Nano Banana Pro headshots)</option>
          <option value="fast">Fast (Nano Banana 2 first)</option>
        </select>
      </div>

      <div>
        <label htmlFor="image_source_mode" className={labelClass}>
          Image source mode
        </label>
        <select
          id="image_source_mode"
          name="image_source_mode"
          className={inputClass}
          defaultValue="bridge"
          onChange={(e) => setImageSourceMode(e.target.value === "auto" ? "auto" : "bridge")}
        >
          <option value="bridge">Bridge (paste URLs)</option>
          <option value="auto">Auto API generation</option>
        </select>
      </div>

      {imageSourceMode === "bridge" ? (
        <fieldset className="space-y-3 rounded-sm border border-white/10 bg-black/20 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-white/70">
            Bridge Image URLs
          </legend>
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <label htmlFor={`headshot_${i}`} className={labelClass}>
                Headshot {i + 1} URL
              </label>
              <input
                id={`headshot_${i}`}
                name={`headshot_${i}`}
                type="url"
                inputMode="url"
                required
                className={inputClass}
                placeholder="https://..."
              />
            </div>
          ))}
          <div>
            <label htmlFor="turnaround" className={labelClass}>
              Turnaround URL
            </label>
            <input
              id="turnaround"
              name="turnaround"
              type="url"
              inputMode="url"
              required
              className={inputClass}
              placeholder="https://..."
            />
          </div>
        </fieldset>
      ) : null}

      {error ? (
        <p className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-sm border-2 border-metallic-orange bg-metallic-orange px-4 py-3 text-sm font-semibold uppercase tracking-wider text-black transition hover:brightness-110 disabled:opacity-40"
      >
        {pending ? "Generating…" : "Create Character Pack"}
      </button>
    </form>
  );
}
