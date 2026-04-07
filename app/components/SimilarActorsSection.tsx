import { ActorGalleryTile } from "./ActorGalleryTile";
import type { ActorRow } from "@/lib/types/actor";

const sectionTitleClass =
  "mb-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-metallic-orange md:text-sm";

type Props = {
  actors: ActorRow[];
};

export function SimilarActorsSection({ actors }: Props) {
  if (actors.length === 0) return null;

  return (
    <section
      id="similar-actors"
      aria-labelledby="similar-actors-heading"
      className="mt-12 border-t border-white/10 pt-10 md:mt-14 md:pt-12"
    >
      <h2 id="similar-actors-heading" className={sectionTitleClass}>
        See similar actors
      </h2>
      <p className="mb-6 text-center text-sm text-white/45">
        Characters with overlapping casting tags or gallery keywords. Use the
        main gallery search to browse everyone.
      </p>
      <ul className="mx-auto grid max-w-[1600px] grid-cols-2 gap-5 sm:gap-6 md:grid-cols-3 md:gap-8 lg:grid-cols-4 xl:gap-10">
        {actors.map((a) => (
          <li key={a.id}>
            <ActorGalleryTile actor={a} />
          </li>
        ))}
      </ul>
    </section>
  );
}
