-- Suggested ElevenLabs voice id (e.g. from AI / 29.txt import) vs production id in levellabs_speech_id after admin approval.

alter table public.actors add column if not exists elevenlabs_voice_suggested_id text;

alter table public.actors add column if not exists elevenlabs_voice_approved_at timestamptz;

comment on column public.actors.elevenlabs_voice_suggested_id is
  'AI or bulk-import suggestion for ElevenLabs; production voice id lives in levellabs_speech_id once approved.';

comment on column public.actors.elevenlabs_voice_approved_at is
  'When production levellabs_speech_id was confirmed to match the character (admin voice review).';
