-- Explicit headshot columns for Table Editor (five total with `headshot_url`).
-- Some projects created `actors` without headshot_url; add base columns first.

alter table public.actors add column if not exists headshot_url text;
alter table public.actors add column if not exists headshot_urls text[] not null default '{}';

alter table public.actors add column if not exists headshot_2_url text;
alter table public.actors add column if not exists headshot_3_url text;
alter table public.actors add column if not exists headshot_4_url text;
alter table public.actors add column if not exists headshot_5_url text;

comment on column public.actors.headshot_url is 'Primary cover headshot URL.';
comment on column public.actors.headshot_2_url is 'Headshot 2 of 5.';
comment on column public.actors.headshot_3_url is 'Headshot 3 of 5.';
comment on column public.actors.headshot_4_url is 'Headshot 4 of 5.';
comment on column public.actors.headshot_5_url is 'Headshot 5 of 5.';
comment on column public.actors.headshot_urls is
  'Legacy text[] extras; app prefers headshot_2_url–headshot_5_url when set.';
