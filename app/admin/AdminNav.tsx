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

  return (
    <nav className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-white/10 pb-4 text-sm">
      <Link href="/" className="text-white/70 transition hover:text-metallic-orange">
        ← Gallery
      </Link>
      <Link href="/admin/cast" className={linkClass(onCast)}>
        Casting form
      </Link>
      <Link href="/admin/add-actor" className={linkClass(onQuickAdd)}>
        Quick add
      </Link>
      <Link href="/studio" className="text-white/70 transition hover:text-metallic-orange">
        Studio
      </Link>
    </nav>
  );
}
