-- Story casting model: reusable actors linked to stories without polluting actor rows.

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  title text not null,
  logline text,
  genre text,
  tone text,
  created_at timestamptz not null default now()
);

create table if not exists public.story_cast (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  actor_id uuid not null references public.actors(id) on delete cascade,
  character_name_in_story text not null,
  role_type text,
  fit_score integer not null default 0,
  status text not null default 'proposed',
  rationale text,
  created_at timestamptz not null default now(),
  unique (story_id, actor_id, character_name_in_story)
);

comment on table public.stories is
  'Story/series concepts used for casting suggestions and approved rosters.';
comment on table public.story_cast is
  'Story-to-actor linking table; actors stay project-agnostic and reusable.';
comment on column public.story_cast.status is
  'Casting lifecycle: proposed, approved, or locked.';
