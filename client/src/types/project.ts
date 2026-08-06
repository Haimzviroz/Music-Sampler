/**
 * The domain model shared by the audio engine, the UI and the server.
 *
 * The server owns the instrument catalog; the client owns the project
 * (which tracks exist, what they play and how loud). Both shapes are
 * mirrored by the FastAPI models so a project can round-trip through
 * `/api/state` unchanged.
 */

/** A kit exposes one sample per voice; a pitched instrument is pitch-shifted across a range. */
export type InstrumentKind = 'kit' | 'pitched';

/**
 * How a voice makes sound. Sample-based instruments come from the server;
 * the built-in fallback catalog is synthesised in the browser so the app
 * still plays when the server is not running.
 */
export type SynthSpec =
  | { engine: 'membrane'; note: string; duration: string; pitchDecay: number; octaves: number; volume: number }
  | { engine: 'noise'; noise: 'white' | 'pink' | 'brown'; duration: string; decay: number; filter: { type: BiquadFilterType; frequency: number }; volume: number }
  | { engine: 'mono'; oscillator: 'sine' | 'square' | 'sawtooth' | 'triangle'; volume: number }
  | { engine: 'fm'; harmonicity: number; modulationIndex: number; volume: number };

export interface SampleDef {
  /** Voice id for a kit (`kick`), scientific pitch for a pitched instrument (`C2`). */
  note: string;
  label: string;
  /** Server-relative audio URL. Empty for synthesised fallback voices. */
  url: string;
  /** Present only in the built-in fallback catalog. */
  synth?: SynthSpec;
}

export interface NoteRange {
  low: string;
  high: string;
}

export interface Instrument {
  id: string;
  name: string;
  kind: InstrumentKind;
  /** Accent colour used by the grid and the mixer. */
  color: string;
  noteRange: NoteRange | null;
  samples: SampleDef[];
  /** Notes added to the grid when the instrument is inserted. */
  defaultNotes: string[];
  /** Shared by every voice of a pitched fallback instrument. */
  synth?: SynthSpec;
}

export interface InstrumentCatalog {
  instruments: Instrument[];
}

/**
 * Per-channel effect chain, all normalised to 0..1 so the UI is three identical
 * sliders and a saved project never carries raw frequencies or decibels.
 */
export interface TrackEffects {
  /** Lowpass cutoff. 1 is fully open, lower values darken the sound. */
  tone: number;
  /** Distortion amount. 0 bypasses the waveshaper entirely. */
  drive: number;
  /** Send level into the shared reverb. */
  reverb: number;
}

export interface Track {
  id: string;
  instrumentId: string;
  note: string;
  label: string;
  steps: boolean[];
  /** Linear gain, 0..1. */
  volume: number;
  muted: boolean;
  solo: boolean;
  effects: TrackEffects;
}

export const DEFAULT_EFFECTS: TrackEffects = { tone: 1, drive: 0, reverb: 0 };

export type EffectName = keyof TrackEffects;

export interface Project {
  version: number;
  name: string;
  bpm: number;
  /** Number of columns in the grid. Every track has exactly this many steps. */
  steps: number;
  /** 0..1, applied as Tone's transport swing on 16th notes. */
  swing: number;
  masterVolume: number;
  loop: boolean;
  tracks: Track[];
}

export const PROJECT_VERSION = 2;

export const LIMITS = {
  bpm: { min: 40, max: 240 },
  steps: { min: 4, max: 64 },
} as const;
