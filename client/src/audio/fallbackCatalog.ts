import type { Instrument } from '../types/project';

/**
 * Catalog used when the server is unreachable.
 *
 * Everything here is synthesised in the browser, so the sampler stays playable
 * with no backend at all. It mirrors the server catalog in the things a saved
 * project depends on — the same four instrument ids, kinds and note ranges — so
 * a project written against real samples still loads and still plays, just with
 * a different timbre. Colours and default notes are allowed to differ.
 */
export const FALLBACK_INSTRUMENTS: Instrument[] = [
  {
    id: 'drums',
    name: 'Drums',
    kind: 'kit',
    color: '#7c5cff',
    noteRange: null,
    defaultNotes: ['kick', 'clap', 'hihat', 'openhat'],
    samples: [
      {
        note: 'kick',
        label: 'Kick',
        url: '',
        synth: { engine: 'membrane', note: 'C1', duration: '8n', pitchDecay: 0.03, octaves: 6, volume: -6 },
      },
      {
        note: 'clap',
        label: 'Clap',
        url: '',
        synth: { engine: 'noise', noise: 'pink', duration: '16n', decay: 0.18, filter: { type: 'bandpass', frequency: 1800 }, volume: -14 },
      },
      {
        note: 'hihat',
        label: 'Hi-Hat',
        url: '',
        synth: { engine: 'noise', noise: 'white', duration: '32n', decay: 0.03, filter: { type: 'highpass', frequency: 9000 }, volume: -20 },
      },
      {
        note: 'openhat',
        label: 'Open Hat',
        url: '',
        synth: { engine: 'noise', noise: 'white', duration: '8n', decay: 0.3, filter: { type: 'highpass', frequency: 7000 }, volume: -22 },
      },
      {
        note: 'perc_lo',
        label: 'Perc Lo',
        url: '',
        synth: { engine: 'noise', noise: 'brown', duration: '16n', decay: 0.12, filter: { type: 'bandpass', frequency: 400 }, volume: -12 },
      },
      {
        note: 'perc_hi',
        label: 'Perc Hi',
        url: '',
        synth: { engine: 'noise', noise: 'white', duration: '16n', decay: 0.09, filter: { type: 'bandpass', frequency: 3200 }, volume: -16 },
      },
    ],
  },
  {
    id: 'bass',
    name: 'Bass',
    kind: 'pitched',
    color: '#41d6a0',
    noteRange: { low: 'C1', high: 'C4' },
    defaultNotes: ['C2', 'D#2', 'F2', 'G2'],
    synth: { engine: 'mono', oscillator: 'sawtooth', volume: -10 },
    samples: [],
  },
  {
    id: 'keys',
    name: 'Keys',
    kind: 'pitched',
    color: '#ffb454',
    noteRange: { low: 'C2', high: 'C5' },
    defaultNotes: ['C3', 'D#3', 'G3', 'A#3'],
    synth: { engine: 'fm', harmonicity: 3, modulationIndex: 10, volume: -16 },
    samples: [],
  },
  {
    id: 'pluck',
    name: 'Pluck',
    kind: 'pitched',
    color: '#ff6b8b',
    noteRange: { low: 'C3', high: 'C6' },
    defaultNotes: ['C4', 'D#4', 'G4', 'A#4'],
    // The sampled version is Karplus–Strong; FM with a short, bright decay is
    // the closest thing that costs nothing to synthesise.
    synth: { engine: 'fm', harmonicity: 2, modulationIndex: 6, volume: -14 },
    samples: [],
  },
];
