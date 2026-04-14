alter table public.actors
  add column if not exists dna_lora_training_urls text[] not null default '{}'::text[];

alter table public.actors
  add column if not exists dna_1_url text,
  add column if not exists dna_2_url text,
  add column if not exists dna_3_url text,
  add column if not exists dna_4_url text,
  add column if not exists dna_5_url text,
  add column if not exists dna_6_url text;
