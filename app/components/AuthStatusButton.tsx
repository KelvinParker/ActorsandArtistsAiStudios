"use client";

import { SignInButton, SignOutButton, useAuth } from "@clerk/nextjs";

type Props = {
  className?: string;
};

export function AuthStatusButton({ className = "" }: Props) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <span
        className={`inline-block rounded-sm border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/45 ${className}`}
      >
        Auth…
      </span>
    );
  }

  if (isSignedIn) {
    return (
      <SignOutButton redirectUrl="/">
        <button
          type="button"
          className={`rounded-sm border border-white/20 bg-black/45 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/80 transition hover:border-metallic-orange/45 hover:text-metallic-orange ${className}`}
        >
          Sign out
        </button>
      </SignOutButton>
    );
  }

  return (
    <SignInButton mode="redirect" fallbackRedirectUrl="/studio" forceRedirectUrl="/studio">
      <button
        type="button"
        className={`rounded-sm border border-white/20 bg-black/45 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/80 transition hover:border-metallic-orange/45 hover:text-metallic-orange ${className}`}
      >
        Sign in
      </button>
    </SignInButton>
  );
}
