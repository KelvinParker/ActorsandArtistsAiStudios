-- Remembers last successful Storage sync fingerprint per actor folder so unchanged trees are skipped.

create table if not exists public.actor_import_storage_sync_state (
  bucket text not null,
  prefix text not null,
  actor_key text not null,
  fingerprint text not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (bucket, prefix, actor_key)
);

create index if not exists actor_import_storage_sync_state_bucket_prefix_idx
  on public.actor_import_storage_sync_state (bucket, prefix);

comment on table public.actor_import_storage_sync_state is
  'SHA-256 fingerprint of importable file paths + sizes + updated_at under each actor_key; sync skips when unchanged.';
