-- Identity lock notes for script/export and generation guardrails.

alter table public.actors add column if not exists must_keep_identity_traits text;

comment on column public.actors.must_keep_identity_traits is
  'Non-negotiable identity notes (facial geometry, hair, signature marks).';
