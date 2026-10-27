# Izmeri tempo iz mp3: spektralni tok -> avtokorelacija.
# raba: python rka-tempo.py <datoteka.mp3> [...]
# Izpise dolzino, BPM in trdnost ritma (koliksen je avtokorelacijski vrh glede
# na nicno zakasnitev). Trdni ritmi imajo vrednosti nad 0.3.

import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import os
import subprocess
import sys

import numpy as np

FFMPEG = r"C:\Users\admin\.qoder\bin\ffmpeg.exe"
SR = 22050
OKNO = 1024
SKOK = 512


def nalozi(pot):
    r = subprocess.run(
        [FFMPEG, "-hide_banner", "-loglevel", "error", "-i", pot,
         "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32)


def tok(zvok):
    """Ovojnica napadov: polovicno popravljena vsota pozitivnih sprememb spektra."""
    stevilo = 1 + max(0, (len(zvok) - OKNO) // SKOK)
    okna = np.lib.stride_tricks.as_strided(
        zvok, shape=(stevilo, OKNO),
        strides=(SKOK * zvok.itemsize, zvok.itemsize), writeable=False)
    zavesa = np.hanning(OKNO).astype(np.float32)
    spekter = np.abs(np.fft.rfft(okna * zavesa, axis=1))
    razlika = np.diff(spekter, axis=0)
    return np.concatenate([[0.0], np.maximum(razlika, 0.0).sum(axis=1)])


def tempo(ovojnica, spodaj=58.0, zgoraj=182.0):
    osredinjena = ovojnica - ovojnica.mean()
    n = len(osredinjena)
    avto = np.correlate(osredinjena, osredinjena, mode="full")
    # Nicelna zakasnitev je pri polni zankanju na mestu n-1, ne na koncu.
    avto = avto[n - 1:][:60000]
    # Utrip na minuto ustreza zakasnitvi razpon/bpm: meja hitrega tempa je
    # spodnja meja zakasnitve, meja pocasnega pa zgornja.
    razpon = SR / SKOK * 60.0
    najmanjsa = max(int(round(razpon / zgoraj)), 2)
    najvecja = min(int(round(razpon / spodaj)), len(avto) - 1)
    if najvecja <= najmanjsa:
        return 0.0, 0.0
    vrh = int(np.argmax(avto[najmanjsa:najvecja + 1])) + najmanjsa

    # Avtokorelacija ima vrh tudi na dvojnikih zakasnitve (L, 2L, 3L ...),
    # zato je polovicni tempo najpogostejsa zmota. Ce je vrh na polovici
    # zakasnitve vsaj 80 % tacnega, je pravi tempo dvakrat visji.
    while vrh // 2 >= najmanjsa and avto[vrh // 2] >= 0.8 * avto[vrh]:
        vrh //= 2

    # Zakasnitev je celo stevilo okvirjev, kar tempo premakne za vec odstotkov;
    # parabola skozi tri sosednje vrednosti jo vrne na delcek okvirja.
    leva, desna = avto[vrh - 1], avto[vrh + 1] if vrh + 1 < len(avto) else 0.0
    sredina = avto[vrh]
    nadj = 0.0
    if leva + desna > 0:
        nadj = 0.5 * (leva - desna) / (leva - 2 * sredina + desna)
        nadj = float(np.clip(nadj, -0.5, 0.5))
    return razpon / (vrh + nadj), float(sredina / avto[0]) if avto[0] else 0.0


for pot in sys.argv[1:]:
    z = nalozi(pot)
    o = tok(z)
    bpm, trdnost = tempo(o)
    print(f"{os.path.basename(pot)}: {len(z) / SR:.1f} s  tempo {bpm:.2f} BPM  "
          f"trdnost {trdnost:.3f}")
