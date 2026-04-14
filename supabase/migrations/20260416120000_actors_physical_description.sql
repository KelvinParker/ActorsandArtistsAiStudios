-- Face DNA: distinct visual features (separate from identity lock text).

alter table public.actors add column if not exists physical_description text;

comment on column public.actors.physical_description is
  'Face DNA: distinct features (eyes, skin, facial hair) for image/model prompts; pairs with must_keep_identity_traits.';
