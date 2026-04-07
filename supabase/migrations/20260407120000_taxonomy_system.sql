-- Casting-facing taxonomy: normalized terms + many-to-many on actors.
-- Run after `actors` exists. Public read; writes use service role (API routes).

create table if not exists public.taxonomy_terms (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  label text not null,
  created_at timestamptz not null default now(),
  constraint taxonomy_terms_category_check check (
    category in (
      'race_ethnicity',
      'age_range',
      'height',
      'weight',
      'eye_color',
      'hair_style',
      'hair_length',
      'hair_color',
      'facial_hair',
      'beard_style'
    )
  ),
  constraint taxonomy_terms_label_nonempty check (length(trim(label)) > 0),
  constraint taxonomy_terms_category_label_unique unique (category, label)
);

create index if not exists taxonomy_terms_category_idx on public.taxonomy_terms (category);

create table if not exists public.actor_taxonomy (
  actor_id uuid not null references public.actors (id) on delete cascade,
  term_id uuid not null references public.taxonomy_terms (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (actor_id, term_id)
);

create index if not exists actor_taxonomy_actor_idx on public.actor_taxonomy (actor_id);
create index if not exists actor_taxonomy_term_idx on public.actor_taxonomy (term_id);

comment on table public.taxonomy_terms is
  'Controlled vocabulary for casting search (race, physical traits, etc.). New values are added via the app API or SQL.';
comment on table public.actor_taxonomy is
  'Links actors to one or more taxonomy terms per category (multi-valued tags).';

alter table public.taxonomy_terms enable row level security;
alter table public.actor_taxonomy enable row level security;

drop policy if exists "taxonomy_terms_select_public" on public.taxonomy_terms;
create policy "taxonomy_terms_select_public"
  on public.taxonomy_terms for select
  using (true);

drop policy if exists "actor_taxonomy_select_public" on public.actor_taxonomy;
create policy "actor_taxonomy_select_public"
  on public.actor_taxonomy for select
  using (true);

-- Inserts/updates: use SUPABASE_SERVICE_ROLE_KEY in Next.js API routes (bypasses RLS).
