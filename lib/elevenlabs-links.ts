/**
 * Shown wherever we nudge ops to open ElevenLabs. We do not assume any preview is free;
 * the account holder must follow current ElevenLabs pricing and terms.
 */
export const elevenlabsPreviewUsageNote =
  "Only use ElevenLabs voice previews or playback that are free for your plan and permitted under the current ElevenLabs terms; anything beyond that (paid credits, commercial use, etc.) is on you and your ElevenLabs agreement.";

/**
 * Deep links for ops to verify a voice id in ElevenLabs (paths may change; ids stay stable).
 */
export function elevenlabsVoiceLabUrl(voiceId: string): string {
  const id = voiceId.trim();
  if (!id) return "https://elevenlabs.io/";
  return `https://elevenlabs.io/app/voice-lab?voiceId=${encodeURIComponent(id)}`;
}

export function elevenlabsVoiceLibraryUrl(): string {
  return "https://elevenlabs.io/app/voice-library";
}

export function elevenlabsDocsUrl(): string {
  return "https://elevenlabs.io/docs";
}
