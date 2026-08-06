import { describe, expect, it } from 'vitest';
import { midiToNote, noteToMidi, notesInRange } from '../notes';

describe('noteToMidi', () => {
  it('parses scientific pitch notation', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C-1')).toBe(0);
    expect(noteToMidi('C#2')).toBe(37);
    expect(noteToMidi('Db2')).toBe(37);
    expect(noteToMidi('c3')).toBe(48);
    expect(noteToMidi(' C2 ')).toBe(36);
  });

  /**
   * Kit voices are named `kick`, `openhat` and so on. `Tone.Frequency` answers
   * NaN for those rather than throwing, and a NaN would end up as a playback
   * rate, so anything that is not a note has to come back as null.
   */
  it('rejects anything that is not a note name', () => {
    for (const value of ['kick', 'openhat', 'perc_hi', '', 'H4', 'C', '4', 'C#', 'Cb#2']) {
      expect(noteToMidi(value)).toBeNull();
    }
  });
});

describe('midiToNote', () => {
  it('round-trips with noteToMidi', () => {
    for (let midi = 0; midi <= 127; midi += 1) {
      expect(noteToMidi(midiToNote(midi))).toBe(midi);
    }
  });

  it('names accidentals as sharps, matching the catalog', () => {
    expect(midiToNote(61)).toBe('C#4');
  });
});

describe('notesInRange', () => {
  it('includes both bounds', () => {
    expect(notesInRange('C4', 'D4')).toEqual(['C4', 'C#4', 'D4']);
    expect(notesInRange('C4', 'C4')).toEqual(['C4']);
    expect(notesInRange('C1', 'C4')).toHaveLength(37);
  });

  it('is empty when a bound is unparsable or inverted', () => {
    expect(notesInRange('D4', 'C4')).toEqual([]);
    expect(notesInRange('kick', 'C4')).toEqual([]);
    expect(notesInRange('C4', 'nonsense')).toEqual([]);
  });
});
