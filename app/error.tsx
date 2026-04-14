"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff8c00]">
        Something went wrong
      </p>
      <h1 className="mt-3 max-w-lg text-lg font-semibold text-white/90">
        {error.message || "This page hit an error while loading."}
      </h1>
      {error.digest ? (
        <p className="mt-2 font-mono text-[11px] text-white/40">Digest: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-sm border-2 border-[#ff8c00] bg-[#ff8c00] px-4 py-2 text-sm font-semibold uppercase tracking-wider text-black hover:brightness-110"
      >
        Try again
      </button>
    </div>
  );
}
