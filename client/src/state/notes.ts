/**
 * Scientific pitch notation helpers. Kept independent of Tone.js so the UI can
 * build note lists without pulling the audio library into a render path.
 */

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const OFFSETS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** `C4` → 60. Returns null for anything that is not a note name (kit voice ids). */
export function noteToMidi(note: string): number | null {
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(note.trim());
  if (!match) return null;

  const [, letter, accidental, octave] = match;
  const base = OFFSETS[letter.toUpperCase()];
  if (base === undefined) return null;

  const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return base + shift + (Number(octave) + 1) * 12;
}

/** 60 → `C4`. Sharps only, which is how the catalog names its samples. */
export function midiToNote(midi: number): string {
  const index = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NAMES[index]}${octave}`;
}

/** Every chromatic note between two bounds, inclusive. Empty if either bound is unparsable. */
export function notesInRange(low: string, high: string): string[] {
  const from = noteToMidi(low);
  const to = noteToMidi(high);
  if (from === null || to === null || to < from) return [];

  const notes: string[] = [];
  for (let midi = from; midi <= to; midi += 1) notes.push(midiToNote(midi));
  return notes;
}
