import Link from "next/link";

/**
 * Footer prompt on actor profile: send users to admin add flow (Clerk sign-in if needed).
 */
export function GalleryCreateCta() {
  return (
    <section
      className="mt-12 border-t border-white/10 pt-10 md:mt-14 md:pt-12"
      aria-labelledby="gallery-create-cta-heading"
    >
      <div className="mx-auto max-w-xl rounded-sm border border-white/10 bg-black/35 px-6 py-8 text-center md:px-8">
        <h2
          id="gallery-create-cta-heading"
          className="text-sm font-semibold uppercase tracking-[0.2em] text-white/55"
        >
          Not seeing the actors you are looking for?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/45">
          Add a new character to the gallery. You will be asked to sign in if you
          are not already.
        </p>
        <Link
          href="/admin/add-actor"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-sm border-2 border-metallic-orange bg-metallic-orange/10 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-metallic-orange transition hover:bg-metallic-orange/20"
        >
          Create it here
        </Link>
      </div>
    </section>
  );
}
