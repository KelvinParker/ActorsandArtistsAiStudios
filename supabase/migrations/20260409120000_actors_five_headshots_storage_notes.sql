-- Five total headshots: primary `headshot_url` + up to four URLs in `headshot_urls`.
-- Height / weight (for Table Editor) — safe if already applied in earlier migrations.

alter table public.actors add column if not exists height text;
alter table public.actors add column if not exists weight text;

comment on column public.actors.height is 'Approximate height (e.g. 6 ft 1 in or 185 cm).';
comment on column public.actors.weight is 'Approximate weight (e.g. ~210 lbs).';

alter table public.actors
  drop constraint if exists actors_headshot_urls_max4;

alter table public.actors
  add constraint actors_headshot_urls_max5 check (
    array_length(headshot_urls, 1) is null
    or array_length(headshot_urls, 1) <= 4
  );

comment on column public.actors.headshot_url is
  'Primary cover image URL (first of up to five headshots in the app).';
comment on column public.actors.headshot_urls is
  'Up to four additional headshot URLs; with headshot_url = five total gallery images.';
comment on column public.actors.turnaround_url is
  'Wide technical turnaround sheet URL.';

-- Storage bucket `actor-assets`: organize uploads per character so packs are traceable.
-- Recommended object path (searchable by id and name slug in the key):
--   {actor_uuid}/{url_safe_name}/headshot-01.webp
--   {actor_uuid}/{url_safe_name}/headshot-02.webp
--   {actor_uuid}/{url_safe_name}/turnaround.webp
--   {actor_uuid}/{url_safe_name}/pack.zip
-- Use `actor_uuid` as the first segment so IDs are always grep-able in Storage.
