import * as Tone from 'tone';

export interface Voice {
  name: string;
  trigger: (time: number) => void;
  dispose: () => void;
}

function createKick(): Voice {
  const synth = new Tone.MembraneSynth({
    volume: -6,
    pitchDecay: 0.03,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.35, sustain: 0 },
  }).toDestination();

  return {
    name: 'Kick',
    trigger: time => synth.triggerAttackRelease('C1', '8n', time),
    dispose: () => synth.dispose(),
  };
}

function createSnare(): Voice {
  const filter = new Tone.Filter(1200, 'bandpass').toDestination();
  const synth = new Tone.NoiseSynth({
    volume: -12,
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.14, sustain: 0 },
  }).connect(filter);

  return {
    name: 'Snare',
    // NoiseSynth has no pitch, so duration comes first.
    trigger: time => synth.triggerAttackRelease('16n', time),
    dispose: () => {
      synth.dispose();
      filter.dispose();
    },
  };
}

function createHiHat(): Voice {
  const filter = new Tone.Filter(9000, 'highpass').toDestination();
  const synth = new Tone.NoiseSynth({
    volume: -20,
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
  }).connect(filter);

  return {
    name: 'Hi-hat',
    trigger: time => synth.triggerAttackRelease('32n', time),
    dispose: () => {
      synth.dispose();
      filter.dispose();
    },
  };
}

function createClap(): Voice {
  const filter = new Tone.Filter(1800, 'bandpass').toDestination();
  const synth = new Tone.NoiseSynth({
    volume: -14,
    noise: { type: 'pink' },
    envelope: { attack: 0.002, decay: 0.22, sustain: 0 },
  }).connect(filter);

  return {
    name: 'Clap',
    trigger: time => synth.triggerAttackRelease('16n', time),
    dispose: () => {
      synth.dispose();
      filter.dispose();
    },
  };
}

/** One voice per grid row, top to bottom. Swap these for Tone.Player
 *  instances once real samples are loaded. */
export function createVoices(): Voice[] {
  return [createKick(), createSnare(), createHiHat(), createClap()];
}
