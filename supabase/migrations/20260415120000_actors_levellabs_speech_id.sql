-- Optional external voice profile id (e.g. ElevenLabs) linked from casting admin.

alter table public.actors add column if not exists levellabs_speech_id text;

comment on column public.actors.levellabs_speech_id is
  'Optional ElevenLabs / other voice id; pairs with free-text speech notes.';
