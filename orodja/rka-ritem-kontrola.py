# Kontrola za rka-ritem.py: generira teste z znanim tempom in preveri, ali jih
# nahajalec vrne. Ce kateri odpove, orodju za bit-mapiranje ne smemo verjeti.
#
# raba: python rka-ritem-kontrola.py
#
# Tri vrste dokaza:
#   klic    - cist klik (klasicna zmota avtokorelacije: polovicni tempo)
#   bobni   - boben na utrip, hat na pol utripa (zmota: dvakratni tempo)
#   zmesan  - bobni z dodatnim utripom in utopljenim uvodom (podoben pravemu posnetku)

import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import os
import subprocess

import numpy as np
import soundfile as sf

SR = 22050
PRIMERI = [(84.0, "bobni"), (100.0, "bobni"), (120.0, "klic"),
           (128.0, "bobni"), (96.9, "klic"), (112.0, "zmesan")]


def zvonek(frekvenca, dolzina, upad):
    t = np.linspace(0, dolzina, int(SR * dolzina), endpoint=False)
    return np.sin(2 * np.pi * frekvenca * t) * np.exp(-t * upad)


def sled(bpm, vrsta, sekund=40):
    x = np.zeros(int(SR * sekund))
    obdobje = 60.0 / bpm
    napadi = ([(0.0, 1000.0, 0.09, 18, 1.0)] if vrsta == "klic" else
              [(0.0, 55.0, 0.13, 30, 1.0),
               (obdobje / 2, 7000.0, 0.03, 200, 0.25)])
    if vrsta == "zmesan":
        napadi = napadi + [(obdobje / 4, 220.0, 0.08, 40, 0.5)]
    for k in range(int(sekund / obdobje) + 1):
        for zamik, frekvenca, dolzina, upad, glasnost in napadi:
            zacetek = int((k * obdobje + zamik) * SR)
            kos = zvonek(frekvenca, dolzina, upad) * glasnost
            if 0 <= zacetek and zacetek + len(kos) < len(x):
                x[zacetek:zacetek + len(kos)] += kos
    if vrsta == "zmesan":
        dvig = np.linspace(0.15, 1.0, int(2 * SR))   # utopljen uvod: prvih 2 s
        x[:len(dvig)] *= dvig
    return x / max(1e-9, np.abs(x).max()) * 0.8


poti = []
for bpm, vrsta in PRIMERI:
    ime = f"kontrola-{vrsta}-{bpm:g}.wav"
    sf.write(ime, sled(bpm, vrsta), SR)
    poti.append((ime, bpm, vrsta))

r = subprocess.run(["python", "rka-ritem.py", *[p for p, _, _ in poti]],
                   capture_output=True, text=True, check=True)
vrnjeni = {}
for vrstica in r.stdout.splitlines():
    if "tempo" in vrstica:
        ime = vrstica.split(":")[0].strip()
        vrnjeni[ime] = float(vrstica.split("tempo")[1].split("BPM")[0])

print(f"{'primer':<28}{'pravi':>8}{'merjeni':>10}{'odstop':>9}  sodba")
napake = 0
for ime, pravi, vrsta in poti:
    merjeni = vrnjeni.get(ime, 0.0)
    sorazmerje = merjeni / pravi
    odstop = abs(sorazmerje - 1) * 100
    dvojni = abs(sorazmerje - 2) < 0.02 or abs(sorazmerje - 0.5) < 0.02
    sodba = "ok" if odstop <= 1.0 else ("dvakratnik/polovica" if dvojni else "NAPAKA")
    if sodba != "ok":
        napake += 1
    print(f"{ime:<28}{pravi:>8.1f}{merjeni:>10.2f}{odstop:>8.2f}%  {sodba}")
print(f"\nslabih primerov: {napake} od {len(poti)}")
for ime, _, _ in poti:
    os.remove(ime)
