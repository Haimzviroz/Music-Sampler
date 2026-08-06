import * as Tone from 'tone';
import type { Instrument, Project, Track, TrackEffects } from '../types/project';
import { DEFAULT_EFFECTS, DEFAULT_TRACK_COLOR } from '../types/project';
import { createVoice, type Voice } from './voices';

/** One step of the grid is a sixteenth note. */
const SUBDIVISION = '16n';
/** Fraction of a step a note is held for, so consecutive steps stay articulate. */
const GATE = 0.9;
/** Cutoff range the `tone` control sweeps, in Hz. */
const FILTER_MIN_HZ = 140;
const FILTER_MAX_HZ = 20000;

/** Maps 0..1 onto the cutoff range logarithmically, which is how pitch is heard. */
function toneToFrequency(amount: number): number {
  const clamped = Math.min(1, Math.max(0, amount));
  return FILTER_MIN_HZ * Math.pow(FILTER_MAX_HZ / FILTER_MIN_HZ, clamped);
}

interface TrackNode {
  /** Voice → drive → filter → gain → master, with a parallel send into the reverb. */
  drive: Tone.Distortion;
  filter: Tone.Filter;
  gain: Tone.Gain;
  send: Tone.Gain;
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
  /**
   * One reverb for the whole rack, fed by a send from each track. A reverb per
   * channel would be the same sound at several times the cost.
   */
  private readonly reverb = new Tone.Reverb({ decay: 2.4, preDelay: 0.01, wet: 1 });
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

  constructor() {
    this.reverb.connect(this.master);
  }

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
        this.applyEffects(existing, track.effects);
        continue;
      }

      // Only the voice depends on the instrument and note; the chain in front of
      // it survives, so changing a row's sound does not click or reset its mix.
      if (existing) {
        existing.voice.dispose();
        existing.voice = this.createTrackVoice(track, existing.drive);
        existing.instrumentId = track.instrumentId;
        existing.note = track.note;
        existing.steps = track.steps;
        existing.muted = track.muted;
        existing.solo = track.solo;
        existing.gain.gain.rampTo(track.volume, 0.02);
        this.applyEffects(existing, track.effects);
        continue;
      }

      const gain = new Tone.Gain(track.volume).connect(this.master);
      const send = new Tone.Gain(0).connect(this.reverb);
      gain.connect(send);
      const filter = new Tone.Filter({ type: 'lowpass', frequency: FILTER_MAX_HZ, Q: 0.7 }).connect(gain);
      const drive = new Tone.Distortion({ distortion: 0, wet: 0 }).connect(filter);

      const node: TrackNode = {
        drive,
        filter,
        gain,
        send,
        voice: this.createTrackVoice(track, drive),
        instrumentId: track.instrumentId,
        note: track.note,
        steps: track.steps,
        muted: track.muted,
        solo: track.solo,
      };

      this.applyEffects(node, track.effects);
      this.nodes.set(track.id, node);
    }

    for (const [id, node] of this.nodes) {
      if (seen.has(id)) continue;
      this.disposeNode(node);
      this.nodes.delete(id);
    }
  }

  private createTrackVoice(track: Track, destination: Tone.InputNode): Voice {
    const instrument = this.instruments.get(track.instrumentId);
    if (instrument) {
      return createVoice(instrument, track.note, destination, this.buffers.get(track.instrumentId));
    }
    return createVoice({ ...EMPTY_INSTRUMENT, id: track.instrumentId }, track.note, destination, undefined);
  }

  private applyEffects(node: TrackNode, effects: TrackEffects | undefined): void {
    const { tone, drive, reverb } = { ...DEFAULT_EFFECTS, ...effects };

    node.filter.frequency.rampTo(toneToFrequency(tone), 0.03);
    node.drive.distortion = drive;
    node.drive.wet.rampTo(drive, 0.03);
    node.send.gain.rampTo(reverb, 0.03);
  }

  private disposeNode(node: TrackNode): void {
    node.voice.dispose();
    node.drive.dispose();
    node.filter.dispose();
    node.send.dispose();
    node.gain.dispose();
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
    this.nodes.forEach(node => this.disposeNode(node));
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
    this.nodes.forEach(node => this.disposeNode(node));
    this.nodes.clear();
    this.buffers.forEach(buffers => buffers.dispose());
    this.buffers.clear();
    this.reverb.dispose();
    this.master.dispose();
  }
}

const EMPTY_INSTRUMENT: Instrument = {
  id: '',
  name: '',
  kind: 'kit',
  color: DEFAULT_TRACK_COLOR,
  noteRange: null,
  samples: [],
  defaultNotes: [],
};
