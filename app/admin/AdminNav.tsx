"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function linkClass(active: boolean): string {
  return active
    ? "text-metallic-orange"
    : "text-white/70 transition hover:text-metallic-orange";
}

export function AdminNav() {
  const pathname = usePathname();
  const onCast = pathname === "/admin/cast";
  const onQuickAdd = pathname === "/admin/add-actor";
  const onImport =
    pathname === "/admin/import-actors" || pathname === "/admin/import";
  const onPipeline = pathname === "/admin/actor-pipeline";
  const onVoice = pathname === "/admin/voice-review";
  const onGalleryOrder = pathname === "/admin/gallery-order";

  return (
    <nav className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-white/10 pb-4 text-sm">
      <Link href="/" className="text-white/70 transition hover:text-metallic-orange">
        ← Gallery
      </Link>
      <Link href="/admin/gallery-order" className={linkClass(onGalleryOrder)}>
        Gallery order
      </Link>
      <Link href="/admin/cast" className={linkClass(onCast)}>
        Casting form
      </Link>
      <Link href="/admin/add-actor" className={linkClass(onQuickAdd)}>
        Quick add
      </Link>
      <Link href="/admin/actor-pipeline" className={linkClass(onPipeline)}>
        Actor pipeline
      </Link>
      <Link href="/admin/voice-review" className={linkClass(onVoice)}>
        Voice review
      </Link>
      <Link href="/admin/import-actors" className={linkClass(onImport)}>
        Import and storage sync
      </Link>
      <Link href="/studio" className="text-white/70 transition hover:text-metallic-orange">
        Studio
      </Link>
    </nav>
  );
}
