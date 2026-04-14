/**
 * OpenAPI 3.0 document for partner HTTP integration (`GET /api/v1/characters`, detail export).
 * Serves from `GET /api/v1/openapi` with `servers[0].url` set to the public site origin.
 */
export function buildPartnerOpenApiDocument(publicOrigin: string): Record<string, unknown> {
  const base = publicOrigin.replace(/\/$/, "");
  return {
    openapi: "3.0.3",
    info: {
      title: "Actors and Artists — Partner character API",
      version: "1.0.0",
      description:
        "Machine-readable catalog and per-character export (Flux DNA LoRA URL, headshots, turnaround, ElevenLabs voice id, style fields). " +
        "Authenticate with the same API key for list and detail. Keys are configured by the studio (`CHARACTER_PACK_API_KEYS`). " +
        "Outbound webhooks: on pack changes, registered partners receive `POST` JSON with `schema_version`, `event`, `actor_id`, `occurred_at`, `integration` URLs, plus headers `X-Actors-Pack-Event` and `X-Actors-Pack-Signature: sha256=<hmac>` (HMAC-SHA256 of the raw body with the hex signing secret). " +
        "Clerk admins register endpoints at `/api/admin/partner-pack-webhooks`.",
    },
    servers: [{ url: base }],
    tags: [
      { name: "Characters", description: "Catalog and character pack export" },
    ],
    paths: {
      "/api/v1/characters": {
        get: {
          tags: ["Characters"],
          summary: "List characters (paginated catalog)",
          description:
            "Returns discovery fields and paths to fetch full packs. Optional `pack_name` filters rows where `pack_name` matches exactly (same as gallery pack filter).",
          parameters: [
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 50, maximum: 100, minimum: 1 },
              description: "Page size (max 100).",
            },
            {
              name: "offset",
              in: "query",
              schema: { type: "integer", default: 0, minimum: 0 },
              description: "Zero-based row offset.",
            },
            {
              name: "pack_name",
              in: "query",
              schema: { type: "string" },
              description: "Exact match on `actors.pack_name` (optional).",
            },
          ],
          security: [{ BearerAuth: [] }, { ApiKeyHeader: [] }],
          responses: {
            "200": {
              description: "Catalog page (`schema_version`, `integration`, `actors`, pagination).",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
            "401": { description: "Missing API key." },
            "403": { description: "Invalid API key." },
            "503": { description: "Partner API keys not configured on server." },
          },
        },
      },
      "/api/v1/characters/{id}": {
        get: {
          tags: ["Characters"],
          summary: "Export one character pack",
          description:
            "Full JSON for pipelines: `dna_lora_url`, `dna_lora_trigger`, image URLs, `levellabs_speech_id`, Face DNA, style tags, etc.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Actor primary key (`actors.id`).",
            },
          ],
          security: [{ BearerAuth: [] }, { ApiKeyHeader: [] }],
          responses: {
            "200": {
              description: "Character pack (`schema_version` 1.0, `actor` object).",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
            "401": { description: "Missing API key." },
            "403": { description: "Invalid API key." },
            "404": { description: "Actor not found." },
            "503": { description: "Partner API keys not configured on server." },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Use `Authorization: Bearer <key>` where `<key>` is a value from `CHARACTER_PACK_API_KEYS`.",
        },
        ApiKeyHeader: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "Same secret as Bearer token; alternative header for clients that prefer it.",
        },
      },
    },
  };
}
