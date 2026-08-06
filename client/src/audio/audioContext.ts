let context: AudioContext | null = null;

/**
 * Lazily creates the single shared AudioContext.
 * Browsers block audio until a user gesture, so this must first be called
 * from a click handler — see resumeAudioContext.
 */
export function getAudioContext(): AudioContext {
  if (!context) {
    context = new AudioContext();
  }
  return context;
}

export async function resumeAudioContext(): Promise<AudioContext> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx;
}
