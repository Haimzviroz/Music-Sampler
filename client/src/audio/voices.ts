import * as Tone from 'tone';
import type { Instrument, SynthSpec } from '../types/project';

/**
 * A voice is one row of the grid made audible: it knows how to make a single
 * sound at a scheduled time and nothing else. The engine owns the gain stage
 * in front of it, so a voice never touches the master output directly.
 */
export interface Voice {
  trigger(time: number, duration: number, velocity: number): void;
  dispose(): void;
}

/**
 * Plays a decoded sample, pitch-shifted by playback rate when the requested
 * note is not the one that was recorded. This is what a hardware sampler does:
 * one root sample covers a range of notes.
 */
class SampleVoice implements Voice {
  private readonly active = new Set<Tone.ToneBufferSource>();
  private readonly buffer: AudioBuffer;
  private readonly playbackRate: number;
  private readonly destination: Tone.InputNode;

  constructor(buffer: AudioBuffer, playbackRate: number, destination: Tone.InputNode) {
    this.buffer = buffer;
    this.playbackRate = playbackRate;
    this.destination = destination;
  }

  trigger(time: number, _duration: number, velocity: number): void {
    // A fresh source per hit keeps the voice polyphonic: a long cymbal tail is
    // not cut off by the next step the way a single reused player would be.
    const source = new Tone.ToneBufferSource({
      url: this.buffer,
      playbackRate: this.playbackRate,
      fadeOut: 0.02,
    }).connect(this.destination);

    source.onended = () => {
      this.active.delete(source);
      source.dispose();
    };

    this.active.add(source);
    source.start(time, 0, undefined, velocity);
  }

  dispose(): void {
    this.active.forEach(source => source.dispose());
    this.active.clear();
  }
}

/** Browser-synthesised voice, used by the offline fallback catalog. */
class SynthVoice implements Voice {
  private readonly nodes: Tone.ToneAudioNode[] = [];
  private readonly play: (time: number, duration: number, velocity: number) => void;

  constructor(spec: SynthSpec, note: string, destination: Tone.InputNode) {
    switch (spec.engine) {
      case 'membrane': {
        const synth = new Tone.MembraneSynth({
          volume: spec.volume,
          pitchDecay: spec.pitchDecay,
          octaves: spec.octaves,
        }).connect(destination);
        this.nodes.push(synth);
        this.play = (time, _duration, velocity) =>
          synth.triggerAttackRelease(spec.note, spec.duration, time, velocity);
        break;
      }
      case 'noise': {
        const filter = new Tone.Filter(spec.filter.frequency, spec.filter.type).connect(destination);
        const synth = new Tone.NoiseSynth({
          volume: spec.volume,
          noise: { type: spec.noise },
          envelope: { attack: 0.001, decay: spec.decay, sustain: 0 },
        }).connect(filter);
        this.nodes.push(synth, filter);
        this.play = (time, _duration, velocity) =>
          synth.triggerAttackRelease(spec.duration, time, velocity);
        break;
      }
      case 'mono': {
        const synth = new Tone.MonoSynth({
          volume: spec.volume,
          oscillator: { type: spec.oscillator },
          envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.2 },
          filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4, baseFrequency: 120, octaves: 3 },
        }).connect(destination);
        this.nodes.push(synth);
        this.play = (time, duration, velocity) =>
          synth.triggerAttackRelease(note, duration, time, velocity);
        break;
      }
      case 'fm': {
        const synth = new Tone.FMSynth({
          volume: spec.volume,
          harmonicity: spec.harmonicity,
          modulationIndex: spec.modulationIndex,
          envelope: { attack: 0.005, decay: 1.2, sustain: 0, release: 0.6 },
          modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 },
        }).connect(destination);
        this.nodes.push(synth);
        this.play = (time, duration, velocity) =>
          synth.triggerAttackRelease(note, duration, time, velocity);
        break;
      }
    }
  }

  trigger(time: number, duration: number, velocity: number): void {
    this.play(time, duration, velocity);
  }

  dispose(): void {
    this.nodes.forEach(node => node.dispose());
    this.nodes.length = 0;
  }
}

/** Silent placeholder so a missing sample degrades to nothing instead of throwing. */
class NullVoice implements Voice {
  trigger(): void {}
  dispose(): void {}
}

function toMidi(note: string): number | null {
  try {
    return Tone.Frequency(note).toMidi();
  } catch {
    return null;
  }
}

/**
 * Picks the sample whose root note is closest to the requested note and returns
 * the playback rate that shifts it into tune. An exact match plays at rate 1.
 */
function nearestSample(instrument: Instrument, note: string) {
  const exact = instrument.samples.find(sample => sample.note === note);
  if (exact) return { sample: exact, playbackRate: 1 };

  const targetMidi = toMidi(note);
  if (targetMidi === null) return null;

  let best: { sample: (typeof instrument.samples)[number]; distance: number; midi: number } | null = null;
  for (const sample of instrument.samples) {
    const midi = toMidi(sample.note);
    if (midi === null) continue;
    const distance = Math.abs(midi - targetMidi);
    if (!best || distance < best.distance) best = { sample, distance, midi };
  }

  if (!best) return null;
  return { sample: best.sample, playbackRate: Math.pow(2, (targetMidi - best.midi) / 12) };
}

/**
 * Builds the voice for one track. Sample data wins when the server catalog is
 * loaded; otherwise the instrument's synth spec is used.
 */
export function createVoice(
  instrument: Instrument,
  note: string,
  destination: Tone.InputNode,
  buffers: Tone.ToneAudioBuffers | undefined,
): Voice {
  const match = buffers ? nearestSample(instrument, note) : null;
  if (match && buffers?.has(match.sample.note)) {
    const audioBuffer = buffers.get(match.sample.note).get();
    if (audioBuffer) {
      return new SampleVoice(audioBuffer, match.playbackRate, destination);
    }
  }

  const spec = instrument.samples.find(sample => sample.note === note)?.synth ?? instrument.synth;
  if (spec) return new SynthVoice(spec, note, destination);

  return new NullVoice();
}
