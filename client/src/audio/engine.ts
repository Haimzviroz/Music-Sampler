import * as Tone from 'tone';
import type { Instrument, Project, Track, TrackEffects } from '../types/project';
import { DEFAULT_EFFECTS, DEFAULT_TRACK_COLOR } from '../types/project';
import { createVoice, type SampleBuffers, type Voice } from './voices';

/** One step of the grid is a sixteenth note. */
const SUBDIVISION = '16n';
/** Fraction of a step a note is held for, so consecutive steps stay articulate. */
const GATE = 0.9;
/** Cutoff range the `tone` control sweeps, in Hz. */
const FILTER_MIN_HZ = 140;
const FILTER_MAX_HZ = 20000;
/** Long enough not to click, short enough to feel immediate. */
const PARAM_RAMP = 0.03;

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
  /** What is currently on the nodes, so a sync only touches what moved. */
  appliedEffects: TrackEffects;
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
  private readonly buffers = new Map<string, SampleBuffers>();
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

  /**
   * Loads each sample on its own, so one missing file costs exactly that voice
   * rather than the whole kit. Whatever arrives is what the instrument can play.
   */
  private async loadInstrument(instrument: Instrument, baseUrl: string): Promise<void> {
    const results = await Promise.all(
      instrument.samples
        .filter(sample => sample.url)
        .map(async sample => {
          try {
            const buffer = await new Tone.ToneAudioBuffer().load(`${baseUrl}${sample.url}`);
            return [sample.note, buffer] as const;
          } catch {
            return null;
          }
        }),
    );

    const loaded: SampleBuffers = new Map();
    for (const result of results) {
      if (result) loaded.set(result[0], result[1]);
    }

    // The engine can be disposed while downloads are still in flight — React
    // StrictMode guarantees at least one such round in development.
    if (this.disposed || loaded.size === 0) {
      loaded.forEach(buffer => buffer.dispose());
      return;
    }

    this.buffers.get(instrument.id)?.forEach(buffer => buffer.dispose());
    this.buffers.set(instrument.id, loaded);
  }

  /** Applies the whole project to the audio graph. Cheap to call on every edit. */
  sync(project: Project, instruments: Instrument[]): void {
    if (this.disposed) return;

    this.instruments = new Map(instruments.map(instrument => [instrument.id, instrument]));

    const transport = Tone.getTransport();
    transport.bpm.value = project.bpm;
    transport.swing = project.swing;
    transport.swingSubdivision = SUBDIVISION;

    this.master.gain.rampTo(project.masterVolume, PARAM_RAMP);
    this.loop = project.loop;
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

      if (existing) {
        // Only the voice depends on the instrument and note; the chain in front
        // of it survives, so changing a row's sound does not click or reset its
        // mix.
        if (existing.instrumentId !== track.instrumentId || existing.note !== track.note) {
          existing.voice.dispose();
          existing.voice = this.createTrackVoice(track, existing.drive);
          existing.instrumentId = track.instrumentId;
          existing.note = track.note;
        }

        existing.steps = track.steps;
        existing.muted = track.muted;
        existing.solo = track.solo;
        existing.gain.gain.rampTo(track.volume, PARAM_RAMP);
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
        // Matches how the nodes above were constructed.
        appliedEffects: { ...DEFAULT_EFFECTS },
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
    const next = { ...DEFAULT_EFFECTS, ...effects };
    const previous = node.appliedEffects;

    if (next.tone !== previous.tone) {
      node.filter.frequency.rampTo(toneToFrequency(next.tone), PARAM_RAMP);
    }

    if (next.drive !== previous.drive) {
      // Assigning `distortion` rebuilds a 4096-point waveshaper curve, so it
      // must not happen on syncs that had nothing to do with the drive.
      node.drive.distortion = next.drive;
      node.drive.wet.rampTo(next.drive, PARAM_RAMP);
    }

    if (next.reverb !== previous.reverb) {
      node.send.gain.rampTo(next.reverb, PARAM_RAMP);
    }

    node.appliedEffects = next;
  }

  private disposeNode(node: TrackNode): void {
    node.voice.dispose();
    node.drive.dispose();
    node.filter.dispose();
    node.send.dispose();
    node.gain.dispose();
  }

  /**
   * The sequence always loops. Assigning `loop` on a running `Tone.Sequence`
   * reschedules every event at its original absolute tick, which for a transport
   * that has moved past those ticks means they never fire again — the sequencer
   * simply goes quiet. A single pass is ended by stopping at the last step
   * instead, in `tick`.
   */
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
    sequence.loop = true;
    this.sequence = sequence;

    if (wasPlaying) sequence.start(0);
  }

  private tick(time: number, step: number): void {
    const stepSeconds = Tone.Time(SUBDIVISION).toSeconds();

    for (const id of this.order) {
      const node = this.nodes.get(id);
      if (!node || node.muted) continue;
      if (this.soloActive && !node.solo) continue;
      if (!node.steps[step]) continue;
      node.voice.trigger(time, stepSeconds * GATE, 1);
    }

    const draw = Tone.getDraw();
    draw.schedule(() => this.onStep?.(step), time);

    if (!this.loop && step === this.stepCount - 1) {
      // Stop on the audio clock at the exact end of the bar, so the pass ends
      // where it should rather than wherever a JS callback happens to land.
      const endTime = time + stepSeconds;
      this.sequence?.stop(endTime);
      Tone.getTransport().stop(endTime);
      draw.schedule(() => this.onEnd?.(), endTime);
    }
  }

  /** Must be called from a user gesture: browsers refuse to start audio otherwise. */
  async start(): Promise<void> {
    await Tone.start();
    if (this.disposed) return;

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
    // `cancel()` with no argument keeps everything inside the lookahead window,
    // which is exactly the queued playhead updates that would light a column
    // back up after the transport has stopped.
    Tone.getDraw().cancel(0);
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

  /**
   * Plays a single track once, for auditioning from the mixer. Starts the audio
   * context first: this is often the first thing a user clicks, before ever
   * pressing play, and the context is suspended until a gesture resumes it.
   */
  async audition(trackId: string): Promise<void> {
    const node = this.nodes.get(trackId);
    if (!node) return;

    await Tone.start();
    if (this.disposed || !this.nodes.has(trackId)) return;

    node.voice.trigger(Tone.now(), Tone.Time('8n').toSeconds(), 1);
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.sequence?.dispose();
    this.sequence = null;
    this.nodes.forEach(node => this.disposeNode(node));
    this.nodes.clear();
    this.buffers.forEach(buffers => buffers.forEach(buffer => buffer.dispose()));
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
