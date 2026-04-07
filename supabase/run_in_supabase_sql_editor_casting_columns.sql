-- Copy every line in this file into Supabase SQL Editor, then click Run.
-- Do not paste only the filename. Select All in this file (Cmd/Ctrl+A), Copy, Paste.

alter table public.actors add column if not exists sex text;
alter table public.actors add column if not exists height text;
alter table public.actors add column if not exists weight text;
alter table public.actors add column if not exists race text;
alter table public.actors add column if not exists traits text[] not null default '{}'::text[];
alter table public.actors add column if not exists speech text;
alter table public.actors add column if not exists search_keywords text[] not null default '{}'::text[];

comment on column public.actors.sex is 'Casting sex or gender (free text).';
comment on column public.actors.height is 'Approximate height for breakdowns.';
comment on column public.actors.weight is 'Approximate weight for breakdowns.';
comment on column public.actors.race is 'Race or heritage text.';
comment on column public.actors.traits is 'Character traits array.';
comment on column public.actors.speech is 'Voice and speech notes.';
comment on column public.actors.search_keywords is 'Search discovery keywords array.';

alter table public.actors alter column sex set default 'N/A';
alter table public.actors alter column height set default 'N/A';
alter table public.actors alter column weight set default 'N/A';
alter table public.actors alter column ethnicity set default 'N/A';

select column_name, data_type, ordinal_position
from information_schema.columns
where table_schema = 'public'
  and table_name = 'actors'
  and column_name in ('sex', 'height', 'weight', 'race', 'traits', 'speech', 'search_keywords')
order by ordinal_position;
