# -*- coding: utf-8 -*-
"""Ali pilot res nosi pravi kos zvoka: izvoznik slike izreže okno, zvok pa je
bil muxan z -ss. Napačen zamik pomeni, da Robert vidi gib in sliši besedilo iz
drugega trenutka — napake, ki je poslušalec ne opazi, ker je kader vedno
sprehoden.

Način: kratki začetni kos pilota (2 s) se pretegne čez masterjevo okolico
pričakovanega zamika in povsod izračuna normalizirano korelacijo. Vrh pove, od
kod zven res prihaja; višina vrha pa, ali gre sploh za isti posnetek.

  raba: python rka-pilot-zvok.py <pilot.mp4> <master.m4a> <pričakovan_zamik_s>
"""
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import subprocess, sys
import numpy as np

FF = r"C:\Users\admin\.qoder\bin\ffmpeg.exe"
AR = 8000
KOS = 2.0            # dolzina vzorca pilota, v sekundah
OKNO = 0.5           # iskanje +- okoli pričakovanega zamika, v sekundah


def pcm(pot, zamik, dolzina):
    r = subprocess.run(
        [FF, "-hide_banner", "-loglevel", "error", "-ss", str(zamik), "-t", str(dolzina),
         "-i", pot, "-ac", "1", "-ar", str(AR), "-f", "s16le", "-"], capture_output=True)
    if r.returncode != 0:
        raise SystemExit("ffmpeg ni razgrnil " + pot + ": "
                         + r.stderr[-260:].decode("utf-8", "replace"))
    a = np.frombuffer(r.stdout, dtype="<i2").astype(np.float64)
    if a.size == 0:
        raise SystemExit("iz " + pot + " ni bilo zvoka")
    return a


def standardiziraj(a):
    return (a - a.mean()) / (np.std(a) + 1e-9)


def main():
    pilot, master, pricakovano = sys.argv[1], sys.argv[2], float(sys.argv[3])
    x = standardiziraj(pcm(pilot, 0.0, KOS))
    zacetek = max(pricakovano - OKNO, 0.0)
    y = pcm(master, zacetek, KOS + 2 * OKNO)
    if len(y) <= len(x):
        raise SystemExit(f"masterjevo okolico ni mogoče vzorčiti: {len(y)} okvirjev "
                         f"proti {len(x)}")
    c = np.correlate(standardiziraj(y), x, mode="valid") / len(x)
    i = int(np.argmax(c))
    najdeno = zacetek + i / AR
    razprsenost = float(np.sqrt(np.mean(c ** 2)))
    print(f"vzorec: prvih {KOS:.1f} s pilota ({len(x) / KOS:.0f} Hz mono), "
          f"masterjevo okolico {zacetek:.2f}-{zacetek + len(y) / AR:.2f} s")
    print(f"najdeni zamik {najdeno:.3f} s · pričakovano {pricakovano:.3f} s · "
          f"razlika {abs(najdeno - pricakovano):.3f} s")
    print(f"vrh korelacije {c[i]:.4f} · povprečje po vseh premikih {razprsenost:.4f} "
          f"· razmerje {c[i] / (razprsenost + 1e-9):.1f}")
    if c[i] < 0.9:
        print("NI V REDU: korelacija je prenizka, da bi trdila isti posnetek.")
    elif abs(najdeno - pricakovano) > 0.05:
        print("NI V REDU: zamik se ne ujema s pričakovanim — pilot ima napačen kos zvoka.")
    else:
        print("V REDU: pilot nosi zvok, ki začne na", f"{pricakovano:.2f} s.")
    print("KONEC")


main()
