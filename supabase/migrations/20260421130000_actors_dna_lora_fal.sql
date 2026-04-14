-- Fal Flux LoRA (DNA) training artifacts per actor; see lib/fal-dna-lora.ts and /api/admin/actors/[id]/dna-lora/*.

alter table public.actors add column if not exists dna_lora_url text;
alter table public.actors add column if not exists dna_lora_trigger text;
alter table public.actors add column if not exists dna_lora_fal_request_id text;
alter table public.actors add column if not exists dna_lora_status text;
alter table public.actors add column if not exists dna_lora_error text;
alter table public.actors add column if not exists dna_lora_completed_at timestamptz;

comment on column public.actors.dna_lora_url is 'Public URL to trained diffusers LoRA weights (Fal output).';
comment on column public.actors.dna_lora_trigger is 'Trigger token used in training / prompts for this character.';
comment on column public.actors.dna_lora_fal_request_id is 'Last fal queue request_id for flux-lora-general-training.';
comment on column public.actors.dna_lora_status is 'queued | processing | completed | failed (or null).';
comment on column public.actors.dna_lora_error is 'Last training failure message.';
comment on column public.actors.dna_lora_completed_at is 'When dna_lora_url was last set successfully.';
