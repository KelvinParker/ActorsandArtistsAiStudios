import { NextResponse } from "next/server";
import { buildPartnerOpenApiDocument } from "@/lib/partner-openapi";
import { getPublicSiteUrl } from "@/lib/public-site-url";

export const dynamic = "force-dynamic";

/**
 * Public OpenAPI 3 document for partner integrations (import into Postman, codegen, etc.).
 * Does not require authentication.
 */
export async function GET() {
  const origin = getPublicSiteUrl() ?? "https://your-site.example.com";
  const doc = buildPartnerOpenApiDocument(origin);
  return NextResponse.json(doc, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
