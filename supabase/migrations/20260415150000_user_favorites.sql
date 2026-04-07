-- Per-user favorite actors (saved shortlist).

create table if not exists public.user_favorites (
  user_id text not null,
  actor_id uuid not null references public.actors (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, actor_id)
);

create index if not exists user_favorites_user_created_idx
  on public.user_favorites (user_id, created_at desc);

comment on table public.user_favorites is
  'Signed-in user favorite actor shortlist.';
comment on column public.user_favorites.user_id is
  'Clerk user id (e.g. user_...).';
