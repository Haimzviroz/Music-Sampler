import * as Tone from 'tone';
import type { Instrument, Project, Track } from '../types/project';
import { createVoice, type Voice } from './voices';

/** One step of the grid is a sixteenth note. */
const SUBDIVISION = '16n';
/** Fraction of a step a note is held for, so consecutive steps stay articulate. */
const GATE = 0.9;

interface TrackNode {
  gain: Tone.Gain;
  voice: Voice;
  instrumentId: string;
  note: string;
  steps: boolean[];
  muted: boolean;
  solo: boolean;
}

/**
 * Owns everything audible: the Tone transport, one gain stage per track and the
 * step sequence that drives them.
 *
 * Scheduling runs on Tone's audio clock rather than a React timer — a JS
 * interval drifts and is throttled to about one second in a background tab,
 * which is audible as soon as the tempo matters. Visual updates are handed to
 * `Tone.Draw` because the audio callback fires ahead of the sound it schedules.
 */
export class SamplerEngine {
  private readonly master = new Tone.Gain(0.8).toDestination();
  private readonly buffers = new Map<string, Tone.ToneAudioBuffers>();
  private readonly nodes = new Map<string, TrackNode>();
  private instruments = new Map<string, Instrument>();
  private order: string[] = [];
  private sequence: Tone.Sequence<number> | null = null;
  private stepCount = 0;
  private loop = true;
  private soloActive = false;
  private disposed = false;

  /** Fired on the audio clock, delivered on the animation frame that matches it. */
  onStep: ((step: number) => void) | null = null;
  /** Fired once the last step of a non-looping pass has sounded. */
  onEnd: (() => void) | null = null;

  /**
   * Downloads and decodes every sample in the catalog. Instruments with no
   * sample urls (the offline fallback) are synthesised and need no loading.
   */
  async loadCatalog(instruments: Instrument[], baseUrl: string): Promise<void> {
    this.instruments = new Map(instruments.map(instrument => [instrument.id, instrument]));

    const pending = instruments
      .filter(instrument => instrument.samples.some(sample => sample.url))
      .map(instrument => this.loadInstrument(instrument, baseUrl));

    await Promise.all(pending);
  }

  private async loadInstrument(instrument: Instrument, baseUrl: string): Promise<void> {
    const urls: Record<string, string> = {};
    for (const sample of instrument.samples) {
      if (sample.url) urls[sample.note] = `${baseUrl}${sample.url}`;
    }
    if (Object.keys(urls).length === 0) return;

    await new Promise<void>(resolve => {
      const buffers = new Tone.ToneAudioBuffers({
        urls,
        onload: () => {
          this.buffers.set(instrument.id, buffers);
          resolve();
        },
        // A missing file must not take the whole app down: the instrument
        // simply falls back to its synth spec, or to silence.
        onerror: () => {
          buffers.dispose();
          resolve();
        },
      });
    });
  }

  /** Applies the whole project to the audio graph. Cheap to call on every edit. */
  sync(project: Project, instruments: Instrument[]): void {
    if (this.disposed) return;

    this.instruments = new Map(instruments.map(instrument => [instrument.id, instrument]));

    const transport = Tone.getTransport();
    transport.bpm.value = project.bpm;
    transport.swing = project.swing;
    transport.swingSubdivision = SUBDIVISION;

    this.master.gain.rampTo(project.masterVolume, 0.02);
    this.setLoop(project.loop);
    this.syncTracks(project.tracks);

    if (project.steps !== this.stepCount) {
      this.stepCount = project.steps;
      this.rebuildSequence();
    }
  }

  private syncTracks(tracks: Track[]): void {
    this.order = tracks.map(track => track.id);
    this.soloActive = tracks.some(track => track.solo);

    const seen = new Set<string>();
    for (const track of tracks) {
      seen.add(track.id);
      const existing = this.nodes.get(track.id);

      if (existing && existing.instrumentId === track.instrumentId && existing.note === track.note) {
        existing.steps = track.steps;
        existing.muted = track.muted;
        existing.solo = track.solo;
        existing.gain.gain.rampTo(track.volume, 0.02);
        continue;
      }

      existing?.voice.dispose();
      existing?.gain.dispose();

      const gain = new Tone.Gain(track.volume).connect(this.master);
      const instrument = this.instruments.get(track.instrumentId);
      const voice = instrument
        ? createVoice(instrument, track.note, gain, this.buffers.get(track.instrumentId))
        : createVoice({ ...EMPTY_INSTRUMENT, id: track.instrumentId }, track.note, gain, undefined);

      this.nodes.set(track.id, {
        gain,
        voice,
        instrumentId: track.instrumentId,
        note: track.note,
        steps: track.steps,
        muted: track.muted,
        solo: track.solo,
      });
    }

    for (const [id, node] of this.nodes) {
      if (seen.has(id)) continue;
      node.voice.dispose();
      node.gain.dispose();
      this.nodes.delete(id);
    }
  }

  private setLoop(loop: boolean): void {
    this.loop = loop;
    if (this.sequence) this.sequence.loop = loop;
  }

  private rebuildSequence(): void {
    const wasPlaying = Tone.getTransport().state === 'started';

    this.sequence?.dispose();
    if (this.stepCount <= 0) {
      this.sequence = null;
      return;
    }

    const sequence = new Tone.Sequence<number>(
      (time, step) => this.tick(time, step),
      Array.from({ length: this.stepCount }, (_, index) => index),
      SUBDIVISION,
    );
    sequence.loop = this.loop;
    this.sequence = sequence;

    if (wasPlaying) sequence.start(0);
  }

  private tick(time: number, step: number): void {
    const duration = Tone.Time(SUBDIVISION).toSeconds() * GATE;

    for (const id of this.order) {
      const node = this.nodes.get(id);
      if (!node || node.muted) continue;
      if (this.soloActive && !node.solo) continue;
      if (!node.steps[step]) continue;
      node.voice.trigger(time, duration, 1);
    }

    const draw = Tone.getDraw();
    draw.schedule(() => this.onStep?.(step), time);

    if (!this.loop && step === this.stepCount - 1) {
      draw.schedule(() => this.onEnd?.(), time + duration);
    }
  }

  /** Must be called from a user gesture: browsers refuse to start audio otherwise. */
  async start(): Promise<void> {
    await Tone.start();
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    this.sequence?.stop();
    this.sequence?.start(0);
    transport.start();
  }

  stop(): void {
    Tone.getTransport().stop();
    this.sequence?.stop();
    Tone.getDraw().cancel();
  }

  /** Jumps back to the first column without interrupting playback. */
  rewind(): void {
    Tone.getTransport().position = 0;
  }

  /**
   * Drops every voice so the next `sync` rebuilds them. Called once the sample
   * buffers finish loading, to replace the synth voices that stood in for them.
   */
  resetVoices(): void {
    this.nodes.forEach(node => {
      node.voice.dispose();
      node.gain.dispose();
    });
    this.nodes.clear();
  }

  /** Plays a single track once, for auditioning from the mixer. */
  audition(trackId: string): void {
    const node = this.nodes.get(trackId);
    if (!node) return;
    const now = Tone.now();
    node.voice.trigger(now, Tone.Time('8n').toSeconds(), 1);
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.sequence?.dispose();
    this.sequence = null;
    this.nodes.forEach(node => {
      node.voice.dispose();
      node.gain.dispose();
    });
    this.nodes.clear();
    this.buffers.forEach(buffers => buffers.dispose());
    this.buffers.clear();
    this.master.dispose();
  }
}

const EMPTY_INSTRUMENT: Instrument = {
  id: '',
  name: '',
  kind: 'kit',
  color: '#7c5cff',
  noteRange: null,
  samples: [],
  defaultNotes: [],
};
