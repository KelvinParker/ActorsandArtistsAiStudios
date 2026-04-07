-- Gallery cover = first element of `headshot_urls`; extras 2–5 are profile-only in the app.
-- Restores headshot columns if any were dropped; safe to re-run.

alter table public.actors add column if not exists headshot_url text;
alter table public.actors add column if not exists headshot_urls text[] not null default '{}';
alter table public.actors add column if not exists headshot_2_url text;
alter table public.actors add column if not exists headshot_3_url text;
alter table public.actors add column if not exists headshot_4_url text;
alter table public.actors add column if not exists headshot_5_url text;

-- If the array was empty but `headshot_url` was set, use it as headshot_urls[1] (gallery cover).
update public.actors
set headshot_urls = array[headshot_url]::text[]
where (headshot_urls is null or cardinality(headshot_urls) = 0)
  and headshot_url is not null
  and btrim(headshot_url) <> '';

comment on column public.actors.headshot_url is
  'Mirror of gallery cover; prefer maintaining headshot_urls[0] in the app.';
comment on column public.actors.headshot_urls is
  'Ordered URLs: first element = gallery tile; remaining = actor profile only.';
comment on column public.actors.headshot_2_url is
  'Legacy column; app reads only when headshot_urls is empty.';
comment on column public.actors.headshot_3_url is 'Legacy; see headshot_2_url.';
comment on column public.actors.headshot_4_url is 'Legacy; see headshot_2_url.';
comment on column public.actors.headshot_5_url is 'Legacy; see headshot_2_url.';
