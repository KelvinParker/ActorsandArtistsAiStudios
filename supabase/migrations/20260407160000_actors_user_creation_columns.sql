-- User-generated actor metadata (self-serve creation flow).

alter table public.actors add column if not exists created_by_user_id text;
alter table public.actors add column if not exists is_user_generated boolean not null default false;
alter table public.actors add column if not exists visibility text not null default 'public';

comment on column public.actors.created_by_user_id is
  'Clerk user id that created the actor via self-serve flow.';
comment on column public.actors.is_user_generated is
  'True when created via user creation flow instead of admin/editor.';
comment on column public.actors.visibility is
  'public or private listing visibility for future marketplace controls.';
