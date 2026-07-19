"""
generate_previews.py — Generate valid WAV preview audio files for all 30 Gemini voices.
# encoding: utf-8

Each file is a proper standards-compliant WAV:
  - Container: RIFF/WAVE (verified by reading first 12 bytes after write)
  - Format: PCM, 16-bit, mono, 22050 Hz
  - Duration: ~2.5 seconds of sine-wave audio (unique frequency per voice)
  - Sentence synthesised: unique tone per voice (sine-wave, frequency-coded)

Output: Frontend/public/previews/<voicename>.wav  (30 files total)

Run from the project root:
  python server/scripts/generate_previews.py
"""

import wave
import struct
import math
import os
import sys

# ── All 30 voices matching VOICES_SEED in App.tsx ─────────────────────────────
VOICES = [
    "Aoede", "Charon", "Fenrir", "Kore", "Leda", "Orus", "Puck", "Zephyr",
    "Callirhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba",
    "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
    "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Adara",
    "Castor", "Deneb", "Eltanin", "Mizar",
]

# ── WAV parameters ─────────────────────────────────────────────────────────────
SAMPLE_RATE   = 22050   # Hz
NUM_CHANNELS  = 1       # mono
BIT_DEPTH     = 16      # bits per sample
DURATION_SECS = 2.5     # seconds per file
AMPLITUDE     = 0.6     # 0.0–1.0 (avoid clipping)

MAX_INT16     = 32767

def voice_frequency(voice_name: str) -> float:
    """
    Derive a unique base frequency for each voice from its name hash.
    Spreads evenly across a musically pleasing range: 200–700 Hz.
    """
    h = sum(ord(c) * (i + 1) for i, c in enumerate(voice_name))
    # Map to 200–700 Hz range
    freq = 200.0 + (h % 501)
    return freq


def generate_wav_samples(frequency: float, sample_rate: int, duration: float) -> list[int]:
    """Generate signed 16-bit PCM samples for a sine wave with optional harmonic."""
    num_samples = int(sample_rate * duration)
    samples = []
    for i in range(num_samples):
        t = i / sample_rate
        # Fundamental + gentle 2nd harmonic for richer timbre
        value = (
            AMPLITUDE * 0.80 * math.sin(2 * math.pi * frequency * t)
            + AMPLITUDE * 0.15 * math.sin(2 * math.pi * frequency * 2 * t)
            + AMPLITUDE * 0.05 * math.sin(2 * math.pi * frequency * 3 * t)
        )
        # Apply a gentle fade-in / fade-out envelope (first/last 5%)
        envelope_len = int(num_samples * 0.05)
        if i < envelope_len:
            value *= i / envelope_len
        elif i > num_samples - envelope_len:
            value *= (num_samples - i) / envelope_len

        sample = int(value * MAX_INT16)
        sample = max(-MAX_INT16, min(MAX_INT16, sample))
        samples.append(sample)
    return samples


def write_wav(filepath: str, samples: list[int], sample_rate: int) -> None:
    """Write samples to a standards-compliant WAV file using Python's wave module."""
    with wave.open(filepath, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)          # 2 bytes = 16-bit
        wf.setframerate(sample_rate)
        # Pack all samples as little-endian signed 16-bit integers
        raw = struct.pack(f'<{len(samples)}h', *samples)
        wf.writeframes(raw)


def verify_wav_header(filepath: str) -> tuple[bool, str]:
    """
    Verify the file begins with RIFF....WAVE (bytes 0–3 = 'RIFF', bytes 8–11 = 'WAVE').
    Returns (ok: bool, detail: str).
    """
    try:
        with open(filepath, 'rb') as f:
            header = f.read(12)
        if len(header) < 12:
            return False, f"File too small ({len(header)} bytes)"
        riff = header[0:4]
        wave_sig = header[8:12]
        if riff != b'RIFF':
            return False, f"Expected RIFF, got {riff!r}"
        if wave_sig != b'WAVE':
            return False, f"Expected WAVE, got {wave_sig!r}"
        size = os.path.getsize(filepath)
        return True, f"OK  [{riff.decode()} / {wave_sig.decode()}]  size={size} bytes"
    except Exception as e:
        return False, f"ERROR: {e}"


def main() -> int:
    # Resolve output directory relative to this script's location
    script_dir  = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, '..', '..'))
    output_dir  = os.path.join(project_root, 'Frontend', 'public', 'previews')

    os.makedirs(output_dir, exist_ok=True)
    print(f"\n{'='*62}")
    print(f"  Gemini Voice Preview WAV Generator")
    print(f"  Output directory: {output_dir}")
    print(f"  Voices: {len(VOICES)}  |  Duration: {DURATION_SECS}s  |  {SAMPLE_RATE}Hz 16-bit mono")
    print(f"{'='*62}\n")

    failures = []

    for voice in VOICES:
        filename  = f"{voice.lower()}.wav"
        filepath  = os.path.join(output_dir, filename)
        frequency = voice_frequency(voice)

        # Generate
        samples = generate_wav_samples(frequency, SAMPLE_RATE, DURATION_SECS)

        # Write valid WAV
        write_wav(filepath, samples, SAMPLE_RATE)

        # Verify header immediately after write
        ok, detail = verify_wav_header(filepath)
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}]  {filename:<22} freq={frequency:6.1f}Hz   {detail}")

        if not ok:
            failures.append((voice, detail))

    print(f"\n{'='*62}")
    if failures:
        print(f"  FAILED: {len(failures)} file(s) did not pass header verification:")
        for name, reason in failures:
            print(f"    - {name}: {reason}")
        print(f"{'='*62}\n")
        return 1
    else:
        print(f"  ALL {len(VOICES)} files passed RIFF/WAVE header verification.")
        print(f"{'='*62}\n")
        return 0


if __name__ == '__main__':
    sys.exit(main())
