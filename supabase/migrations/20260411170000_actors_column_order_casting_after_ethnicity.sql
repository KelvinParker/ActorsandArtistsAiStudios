-- Table Editor column order: place sex, height, weight immediately after ethnicity.
-- PostgreSQL appends `ADD COLUMN` at the end; this one-time rebuild fixes legacy tables.

begin;

-- Ensure source row shape exists (partial migration history).
alter table public.actors add column if not exists sex text;
alter table public.actors add column if not exists height text;
alter table public.actors add column if not exists weight text;
alter table public.actors add column if not exists race text;
alter table public.actors add column if not exists traits text[];
alter table public.actors add column if not exists speech text;
alter table public.actors add column if not exists search_keywords text[];
alter table public.actors add column if not exists headshot_urls text[];
alter table public.actors add column if not exists headshot_2_url text;
alter table public.actors add column if not exists headshot_3_url text;
alter table public.actors add column if not exists headshot_4_url text;
alter table public.actors add column if not exists headshot_5_url text;

do $drop_actor_fk$
begin
  if to_regclass('public.actor_taxonomy') is not null then
    alter table public.actor_taxonomy
      drop constraint if exists actor_taxonomy_actor_id_fkey;
  end if;
end;
$drop_actor_fk$;

alter table public.actors drop constraint if exists actors_headshot_urls_max5;
alter table public.actors drop constraint if exists actors_headshot_urls_max4;

alter table public.actors rename to actors_legacy_column_order;

create table public.actors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age text,
  ethnicity text,
  sex text,
  height text,
  weight text,
  tags text[] not null default '{}',
  headshot_url text,
  turnaround_url text,
  race text,
  traits text[] not null default '{}',
  speech text,
  search_keywords text[] not null default '{}',
  headshot_urls text[] not null default '{}',
  headshot_2_url text,
  headshot_3_url text,
  headshot_4_url text,
  headshot_5_url text
);

insert into public.actors (
  id,
  name,
  age,
  ethnicity,
  sex,
  height,
  weight,
  tags,
  headshot_url,
  turnaround_url,
  race,
  traits,
  speech,
  search_keywords,
  headshot_urls,
  headshot_2_url,
  headshot_3_url,
  headshot_4_url,
  headshot_5_url
)
select
  id,
  name,
  age,
  ethnicity,
  sex,
  height,
  weight,
  coalesce(tags, '{}'),
  headshot_url,
  turnaround_url,
  race,
  coalesce(traits, '{}'),
  speech,
  coalesce(search_keywords, '{}'),
  coalesce(headshot_urls, '{}'),
  headshot_2_url,
  headshot_3_url,
  headshot_4_url,
  headshot_5_url
from public.actors_legacy_column_order;

alter table public.actors alter column sex set default 'N/A';
alter table public.actors alter column height set default 'N/A';
alter table public.actors alter column weight set default 'N/A';
alter table public.actors alter column ethnicity set default 'N/A';

alter table public.actors
  add constraint actors_headshot_urls_max5 check (
    array_length(headshot_urls, 1) is null
    or array_length(headshot_urls, 1) <= 4
  );

do $add_actor_fk$
begin
  if to_regclass('public.actor_taxonomy') is not null then
    alter table public.actor_taxonomy
      add constraint actor_taxonomy_actor_id_fkey
      foreign key (actor_id) references public.actors (id) on delete cascade;
  end if;
end;
$add_actor_fk$;

comment on table public.actors is 'Actor directory; add RLS policies when wiring Clerk + Supabase JWT or server-only access.';
comment on column public.actors.sex is
  'Casting-facing sex/gender presentation (free text or controlled labels).';
comment on column public.actors.height is
  'Approximate height (e.g. 6 ft 1 in or 185 cm).';
comment on column public.actors.weight is
  'Approximate weight (e.g. 195 lbs).';
comment on column public.actors.race is 'Race / heritage (optional if ethnicity covers it).';
comment on column public.actors.traits is 'Personality / character traits (e.g. gritty, loyal).';
comment on column public.actors.speech is 'Voice: dialect, cadence, verbal tics.';
comment on column public.actors.search_keywords is
  'Terms that should surface this character in search (names, nicknames, roles).';
comment on column public.actors.headshot_url is
  'Primary cover image URL (first of up to five headshots in the app).';
comment on column public.actors.headshot_urls is
  'Up to four additional headshot URLs; with headshot_url = five total gallery images.';
comment on column public.actors.headshot_2_url is 'Headshot 2 of 5.';
comment on column public.actors.headshot_3_url is 'Legacy; see headshot_2_url.';
comment on column public.actors.headshot_4_url is 'Legacy; see headshot_2_url.';
comment on column public.actors.headshot_5_url is 'Legacy; see headshot_2_url.';
comment on column public.actors.turnaround_url is
  'Wide technical turnaround sheet URL.';

drop table public.actors_legacy_column_order;

commit;
