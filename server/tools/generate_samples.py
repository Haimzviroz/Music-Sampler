"""Synthesize the pitched instrument samples shipped with the server.

Only root notes are rendered: the client loads them into a Tone.Sampler,
which pitch-shifts to cover the rest of the range. Everything here is pure
standard library on purpose -- the server has no numpy dependency and the
samples are a build artifact, not a runtime concern.

Usage (from server/):
    python tools/generate_samples.py           # write the WAV files
    python tools/generate_samples.py --check   # verify what is on disk
"""

from __future__ import annotations

import argparse
import math
import random
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 44100
SAMPLE_WIDTH = 2  # 16-bit PCM
CHANNELS = 1

FADE_IN_SEC = 0.005
FADE_OUT_SEC = 0.030
PEAK_DBFS = -3.0

AUDIO_DIR = Path(__file__).resolve().parent.parent / "audio"

# Root notes per instrument. Tone.Sampler interpolates everything else.
ROOTS = {
    "bass": ["C1", "C2", "C3"],
    "keys": ["C2", "C3", "C4"],
    "pluck": ["C3", "C4", "C5"],
}

SEMITONES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def note_to_freq(note: str) -> float:
    """Convert a scientific-pitch note name (``C#3``, ``Eb2``) to Hz."""
    letter = note[0].upper()
    if letter not in SEMITONES:
        raise ValueError(f"bad note name: {note!r}")
    index = 1
    semitone = SEMITONES[letter]
    while index < len(note) and note[index] in "#b":
        semitone += 1 if note[index] == "#" else -1
        index += 1
    octave = int(note[index:])
    midi = (octave + 1) * 12 + semitone
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)


def note_seed(instrument: str, note: str) -> int:
    """Stable per-sample seed so regenerating produces identical bytes.

    ``hash()`` is salted per interpreter run, hence the hand-rolled sum.
    """
    return sum((i + 1) * ord(ch) for i, ch in enumerate(f"{instrument}:{note}"))


# --------------------------------------------------------------------------
# Synthesis
# --------------------------------------------------------------------------


def render_bass(freq: float, seed: int) -> list[float]:
    """Warm sub bass: sine fundamental plus a few saw-ish harmonics.

    Harmonics get shorter decay times than the fundamental, so the tone
    darkens as it rings out instead of buzzing all the way down.
    """
    duration = 1.2
    total = int(SAMPLE_RATE * duration)
    attack = int(SAMPLE_RATE * 0.008)
    base_tau = 0.45

    partials: list[tuple[float, float, float]] = []  # (freq, amp, tau)
    nyquist = SAMPLE_RATE / 2.0
    for k in range(1, 9):
        partial_freq = freq * k
        if partial_freq >= nyquist * 0.9:
            break
        amp = 1.0 if k == 1 else 0.18 / k
        tau = base_tau / (1.0 + 0.55 * (k - 1))
        partials.append((partial_freq, amp, tau))

    out = [0.0] * total
    step = 2.0 * math.pi / SAMPLE_RATE
    for i in range(total):
        t = i / SAMPLE_RATE
        value = 0.0
        for partial_freq, amp, tau in partials:
            value += amp * math.exp(-t / tau) * math.sin(step * partial_freq * i)
        if i < attack:
            value *= i / attack
        out[i] = value
    return out


def render_keys(freq: float, seed: int) -> list[float]:
    """FM electric piano: 3:1 carrier/modulator with a decaying index.

    A quiet, fast-decaying partial four octaves-ish up stands in for the
    tine strike, which is what gives the bell-like attack.
    """
    duration = 2.0
    total = int(SAMPLE_RATE * duration)
    attack = int(SAMPLE_RATE * 0.003)

    carrier = freq
    modulator = freq * 3.0
    index_start = 3.2
    index_tau = 0.22
    body_tau = 0.85

    tine_carrier = freq * 6.0
    tine_mod = freq * 6.0
    tine_tau = 0.12

    out = [0.0] * total
    step = 2.0 * math.pi / SAMPLE_RATE
    for i in range(total):
        t = i / SAMPLE_RATE
        index = index_start * math.exp(-t / index_tau)
        body = math.exp(-t / body_tau) * math.sin(
            step * carrier * i + index * math.sin(step * modulator * i)
        )
        tine_index = 1.4 * math.exp(-t / 0.05)
        tine = 0.22 * math.exp(-t / tine_tau) * math.sin(
            step * tine_carrier * i + tine_index * math.sin(step * tine_mod * i)
        )
        value = body + tine
        if i < attack:
            value *= i / attack
        out[i] = value
    return out


def render_pluck(freq: float, seed: int) -> list[float]:
    """Karplus-Strong plucked string.

    The loop filter is a two-tap average blended by ``blend``; short delay
    lines (high notes) run through it far more often per second, so the
    blend is scaled by the delay length to keep the decay time comparable
    across the range. A global exponential tail guarantees silence at the
    end regardless of the loop gain.
    """
    duration = 1.5
    total = int(SAMPLE_RATE * duration)
    delay = max(2, int(round(SAMPLE_RATE / freq)))

    rng = random.Random(seed)
    # Excite with lowpass-filtered noise: a raw noise burst is harsh.
    buf = [rng.uniform(-1.0, 1.0) for _ in range(delay)]
    smoothed = []
    previous = 0.0
    for value in buf:
        previous = 0.6 * value + 0.4 * previous
        smoothed.append(previous)
    buf = smoothed

    blend = 0.5 * min(1.0, delay / 420.0)
    damping = 0.9998
    tail_tau = 0.55

    out = [0.0] * total
    pos = 0
    previous = 0.0
    for i in range(total):
        current = buf[pos]
        filtered = damping * ((1.0 - blend) * current + blend * previous)
        previous = current
        buf[pos] = filtered
        pos = (pos + 1) % delay
        out[i] = current * math.exp(-(i / SAMPLE_RATE) / tail_tau)
    return out


RENDERERS = {"bass": render_bass, "keys": render_keys, "pluck": render_pluck}


# --------------------------------------------------------------------------
# Post-processing and IO
# --------------------------------------------------------------------------


def apply_fades(samples: list[float]) -> None:
    """Fade the edges so the sampler cannot click on start or release."""
    fade_in = min(int(SAMPLE_RATE * FADE_IN_SEC), len(samples))
    fade_out = min(int(SAMPLE_RATE * FADE_OUT_SEC), len(samples))
    for i in range(fade_in):
        samples[i] *= i / fade_in
    for i in range(fade_out):
        samples[len(samples) - 1 - i] *= i / fade_out


def normalize(samples: list[float], peak_dbfs: float = PEAK_DBFS) -> None:
    target = 10.0 ** (peak_dbfs / 20.0)
    peak = max((abs(s) for s in samples), default=0.0)
    if peak <= 0.0:
        raise ValueError("refusing to normalize a silent buffer")
    gain = target / peak
    for i in range(len(samples)):
        samples[i] *= gain


def write_wav(path: Path, samples: list[float]) -> None:
    frames = bytearray()
    for value in samples:
        clamped = max(-1.0, min(1.0, value))
        frames += struct.pack("<h", int(round(clamped * 32767.0)))
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(CHANNELS)
        handle.setsampwidth(SAMPLE_WIDTH)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(bytes(frames))


def read_wav(path: Path) -> tuple[list[int], int, int, int]:
    with wave.open(str(path), "rb") as handle:
        channels = handle.getnchannels()
        width = handle.getsampwidth()
        rate = handle.getframerate()
        raw = handle.readframes(handle.getnframes())
    if width != 2:
        raise ValueError(f"{path.name}: expected 16-bit PCM, got {width * 8}-bit")
    values = list(struct.unpack(f"<{len(raw) // 2}h", raw))
    return values, channels, rate, width


def generate(out_dir: Path) -> list[Path]:
    written: list[Path] = []
    for instrument, notes in ROOTS.items():
        render = RENDERERS[instrument]
        for note in notes:
            samples = render(note_to_freq(note), note_seed(instrument, note))
            apply_fades(samples)
            normalize(samples)
            path = out_dir / instrument / f"{note}.wav"
            write_wav(path, samples)
            written.append(path)
            print(f"wrote {path.relative_to(out_dir.parent)} ({path.stat().st_size} bytes)")
    return written


def check(out_dir: Path) -> int:
    """Verify every expected sample is a readable, non-silent WAV."""
    failures = 0
    print(f"{'file':<22}{'sec':>7}{'peak':>9}{'peak dBFS':>12}{'rms':>9}{'rms dBFS':>11}{'KB':>8}")
    for instrument, notes in ROOTS.items():
        for note in notes:
            path = out_dir / instrument / f"{note}.wav"
            label = f"{instrument}/{note}.wav"
            if not path.exists():
                print(f"{label:<22} MISSING")
                failures += 1
                continue
            try:
                values, channels, rate, _ = read_wav(path)
            except Exception as exc:  # noqa: BLE001 - report and continue
                print(f"{label:<22} UNREADABLE: {exc}")
                failures += 1
                continue
            if not values:
                print(f"{label:<22} EMPTY")
                failures += 1
                continue
            peak = max(abs(v) for v in values) / 32767.0
            rms = math.sqrt(sum(v * v for v in values) / len(values)) / 32767.0
            seconds = len(values) / channels / rate
            if peak < 0.05 or rms < 0.001:
                print(f"{label:<22} SILENT (peak={peak:.4f} rms={rms:.4f})")
                failures += 1
                continue
            peak_db = 20 * math.log10(peak)
            rms_db = 20 * math.log10(rms)
            size_kb = path.stat().st_size / 1024
            print(
                f"{label:<22}{seconds:>7.2f}{peak:>9.4f}{peak_db:>12.2f}"
                f"{rms:>9.4f}{rms_db:>11.2f}{size_kb:>8.1f}"
            )
            if rate != SAMPLE_RATE or channels != CHANNELS:
                print(f"{label:<22} FORMAT {channels}ch @ {rate} Hz (expected mono 44100)")
                failures += 1
            if size_kb > 400:
                print(f"{label:<22} TOO LARGE ({size_kb:.1f} KB)")
                failures += 1
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        default=AUDIO_DIR,
        help="audio root directory (default: server/audio)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="only verify the files already on disk",
    )
    args = parser.parse_args()

    if not args.check:
        generate(args.out)
    failures = check(args.out)
    if failures:
        print(f"\n{failures} problem(s) found")
        return 1
    print("\nall samples ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
