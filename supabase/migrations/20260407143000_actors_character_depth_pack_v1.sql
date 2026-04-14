-- Character depth pack v1: narrative and marketplace attributes.

alter table public.actors add column if not exists origin_city text;
alter table public.actors add column if not exists backstory_summary text;
alter table public.actors add column if not exists primary_goal text;
alter table public.actors add column if not exists core_wound text;
alter table public.actors add column if not exists fatal_flaw text;
alter table public.actors add column if not exists signature_style text;
alter table public.actors add column if not exists market_segment text;

comment on column public.actors.origin_city is
  'Character origin city used for world anchoring and search.';
comment on column public.actors.backstory_summary is
  'Short narrative backstory synopsis for marketplace listings.';
comment on column public.actors.primary_goal is
  'Primary motivation/objective driving the character arc.';
comment on column public.actors.core_wound is
  'Internal wound/trauma shaping decisions and emotional reactions.';
comment on column public.actors.fatal_flaw is
  'Main flaw that creates risk, conflict, and story tension.';
comment on column public.actors.signature_style is
  'Signature wardrobe/aesthetic shorthand for continuity and merchandising.';
comment on column public.actors.market_segment is
  'Commercial grouping for packaging/sales (lead, supporting, villain, etc.).';
