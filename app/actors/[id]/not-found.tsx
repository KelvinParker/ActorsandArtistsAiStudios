import Link from "next/link";

export default function ActorNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center bg-cinematic-black px-6 text-center text-foreground">
      <h1 className="text-xl font-semibold text-white">Character not found</h1>
      <p className="mt-2 text-sm text-white/50">
        That actor may have been removed or the link is invalid.
      </p>
      <Link
        href="/"
        className="mt-6 text-sm text-metallic-orange hover:brightness-110"
      >
        ← Back to gallery
      </Link>
    </div>
  );
}
