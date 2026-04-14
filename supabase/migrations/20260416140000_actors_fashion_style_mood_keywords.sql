-- Visual continuity: locked wardrobe line + visual tone (canonical Field IDs 3.0 / 4.0).

alter table public.actors add column if not exists fashion_style text;

alter table public.actors add column if not exists mood_keywords text;

comment on column public.actors.fashion_style is
  'Locked uniform / standard clothing set for continuity (Field 3.0). Complements signature_style / VCP-4.';

comment on column public.actors.mood_keywords is
  'Visual tone: lighting, color palette, mood tags (Field 4.0). Free text or comma-separated phrases.';
