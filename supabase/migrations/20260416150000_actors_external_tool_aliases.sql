-- Documentation for external pipelines (ComfyUI, Higgsfield, etc.).
-- Canonical column names remain physical_description / fashion_style / mood_keywords.

comment on column public.actors.physical_description is
  'Field 2.0 Face DNA. External docs may call this face_dna — same column.';

comment on column public.actors.fashion_style is
  'Field 3.0 locked uniform. External docs may call this locked_uniform — same column.';

comment on column public.actors.mood_keywords is
  'Field 4.0 visual tone / palette. External docs may call this visual_tone — same column.';
