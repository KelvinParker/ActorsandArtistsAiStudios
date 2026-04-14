import { ethnicityDisplay, playingAgeDisplay, statOrNA } from "@/lib/actor-display";
import type { ActorRow } from "@/lib/types/actor";

type Props = {
  actor: ActorRow;
  /** Nested under Character details in `ActorCard` (no full section chrome). */
  variant?: "section" | "inline";
};

/**
 * Ethnicity (primary) | Sex | Age range | Height | Weight — horizontal bar.
 * Use `variant="inline"` at the top of Character details next to traits/speech.
 */
export function ActorProfileStatsBar({
  actor,
  variant = "section",
}: Props) {
  const items = [
    { label: "Ethnicity", value: ethnicityDisplay(actor) },
    { label: "Sex", value: statOrNA(actor.sex) },
    { label: "Age range", value: playingAgeDisplay(actor) },
    { label: "Height", value: statOrNA(actor.height) },
    { label: "Weight", value: statOrNA(actor.weight) },
    { label: "Vocal range", value: statOrNA(actor.vocal_range) },
    { label: "Motivation", value: statOrNA(actor.personality_archetype) },
  ] as const;

  const shell =
    variant === "inline"
      ? "mb-5 border-b border-white/10 pb-5"
      : "mb-8 border-y border-white/10 py-4";

  return (
    <div className={shell} role="group" aria-label="Casting stats">
      <ul className="flex flex-wrap items-center justify-center gap-y-3 text-xs md:justify-start md:text-sm">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center">
            {i > 0 ? (
              <span
                aria-hidden
                className="mx-3 select-none text-white/25 sm:mx-4 md:mx-5"
              >
                |
              </span>
            ) : null}
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-metallic-orange/90 md:text-xs">
              {item.label}
            </span>
            <span className="ml-2 text-white/90">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
