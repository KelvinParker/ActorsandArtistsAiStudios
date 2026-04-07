import type { NextConfig } from "next";

function supabaseStorageHostname(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return undefined;
  try {
    return new URL(raw).hostname;
  } catch {
    return undefined;
  }
}

const supabaseHost = supabaseStorageHostname();

const nextConfig: NextConfig = {
  /** Casting / add-actor forms upload images via Server Actions (multipart). */
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  images: supabaseHost
    ? {
        remotePatterns: [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ],
      }
    : {},
};

export default nextConfig;
