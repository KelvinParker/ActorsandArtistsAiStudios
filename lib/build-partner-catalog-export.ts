import { getGalleryCoverUrl } from "@/lib/actor-headshots";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import type { ActorRow } from "@/lib/types/actor";

export type PartnerCatalogActorV1 = {
  id: string;
  name: string;
  stage_name: string | null;
  pack_name: string | null;
  gallery_cover_url: string | null;
  dna_lora_url: string | null;
  dna_lora_status: string | null;
  /** Public profile page on Actors and Artists (browser). */
  profile_url: string | null;
  /** Same-origin API path for full pack JSON (use with same API key). */
  character_pack_path: string;
};

export type PartnerCatalogExportV1 = {
  schema_version: "1.0";
  integration: {
    description: string;
    list_path: string;
    detail_path_template: string;
    authentication: string;
  };
  actors: PartnerCatalogActorV1[];
  limit: number;
  offset: number;
  has_more: boolean;
  /** Echo when `pack_name` query filter was applied (exact match). */
  pack_name_filter: string | null;
};

type CatalogRow = Pick<
  ActorRow,
  "id" | "name" | "stage_name" | "pack_name" | "headshot_url" | "headshot_urls"
> &
  Partial<Pick<ActorRow, "dna_lora_url" | "dna_lora_status">>;

export function buildPartnerCatalogExportV1(
  rows: CatalogRow[],
  options: {
    limit: number;
    offset: number;
    hasMore: boolean;
    packNameFilter: string | null;
  },
): PartnerCatalogExportV1 {
  const base = getPublicSiteUrl();
  const actors: PartnerCatalogActorV1[] = rows.map((row) => {
    const cover = getGalleryCoverUrl(row as ActorRow);
    const id = row.id;
    return {
      id,
      name: row.name,
      stage_name: row.stage_name?.trim() || null,
      pack_name: row.pack_name?.trim() || null,
      gallery_cover_url: cover,
      dna_lora_url: row.dna_lora_url?.trim() || null,
      dna_lora_status: row.dna_lora_status?.trim() || null,
      profile_url: base ? `${base}/actors/${id}` : null,
      character_pack_path: `/api/v1/characters/${id}`,
    };
  });

  return {
    schema_version: "1.0",
    integration: {
      description:
        "Use one CHARACTER_PACK_API_KEYS value per partner. List the catalog, then GET each character_pack_path for full LoRA, images, and voice metadata.",
      list_path: "/api/v1/characters",
      detail_path_template: "/api/v1/characters/{id}",
      authentication: "Authorization: Bearer <key> or x-api-key: <key>",
    },
    actors,
    limit: options.limit,
    offset: options.offset,
    has_more: options.hasMore,
    pack_name_filter: options.packNameFilter,
  };
}
