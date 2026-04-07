-- If the main casting script errors, try this minimal version (alters + defaults only).
-- Copy all non-comment lines into Supabase SQL Editor and Run.

alter table public.actors add column if not exists sex text;
alter table public.actors add column if not exists height text;
alter table public.actors add column if not exists weight text;
alter table public.actors add column if not exists race text;
alter table public.actors add column if not exists traits text[] not null default '{}'::text[];
alter table public.actors add column if not exists speech text;
alter table public.actors add column if not exists search_keywords text[] not null default '{}'::text[];
alter table public.actors alter column sex set default 'N/A';
alter table public.actors alter column height set default 'N/A';
alter table public.actors alter column weight set default 'N/A';
alter table public.actors alter column ethnicity set default 'N/A';
