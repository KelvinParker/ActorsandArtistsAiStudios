-- Up to 3 additional gallery images alongside `headshot_url` (4 total when all set).
-- Application enforces max 4 combined; DB allows extra array slots — trim in app or add trigger later.

alter table public.actors
  add column if not exists headshot_urls text[] not null default '{}';

comment on column public.actors.headshot_urls is
  'Extra profile image URLs (0–3 typical); primary remains headshot_url. Max 4 images total in the app UI.';

alter table public.actors
  drop constraint if exists actors_headshot_urls_max4;

alter table public.actors
  add constraint actors_headshot_urls_max4 check (
    array_length(headshot_urls, 1) is null
    or array_length(headshot_urls, 1) <= 3
  );
