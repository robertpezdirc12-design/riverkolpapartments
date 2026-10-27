# Nahaje udarno mrezo glasbe: tempo, zamik prvega utripa in kakovost mreze.
#
# raba: python rka-ritem.py <datoteka> [...]
#
# Metoda ni avtokorelacija: ta ima na cistem kliku enako visoke vrhove na
# L, 2L in 3L, zato pogosto izbere polovicni tempo. Namesto tega mreza direktno
# proba obdobja in faze ter steje, kolikso vsoto napadov nalozijo utripi. To je
# fazno zaklenjeno in polovicna mreza ne more zmagati, ker vecino utripov sprici
# pade med napade, ne nanje.
#
# Izpis "zaklad" je razmerje med povprecno visino ovojnice na utriptih in njenim
# splosnim povprecjem. Nad 2.0 pomeni da mreza res sedi na glasbo; pod 1.4 je
# napovedana hitrost samo stevilka.

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
URADA = SR / SKOK * 60.0          # BPM, ki ustreza zakasnitvi enega okvirja
FAZE = 96                          # kolikso faz probamo na obdobje


def nalozi(pot):
    r = subprocess.run(
        [FFMPEG, "-hide_banner", "-loglevel", "error", "-i", pot,
         "-ac", "1", "-ar", str(SR), "-t", "90", "-f", "f32le", "-"],
        capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32)


def ovojnica(zvok):
    """Ovojnica napadov: polovicno popravljena vsota pozitivnih sprememb spektra."""
    stevilo = 1 + max(0, (len(zvok) - OKNO) // SKOK)
    okvirji = np.lib.stride_tricks.as_strided(
        zvok, shape=(stevilo, OKNO),
        strides=(SKOK * zvok.itemsize, zvok.itemsize), writeable=False)
    zavesa = np.hanning(OKNO).astype(np.float32)
    spekter = np.abs(np.fft.rfft(okvirji * zavesa, axis=1))
    tok = np.diff(spekter, axis=0)
    o = np.concatenate([[0.0], np.maximum(tok, 0.0).sum(axis=1)])
    if o.max() > 0:
        o = o / o.max()
    return o.astype(np.float64)


def mreza(o, bpm):
    """Najboljsa faza za dani tempo: vrne (cas prvega utripa v sekundah, oceno)."""
    obdobje = URADA / bpm
    n = int((len(o) - 1) / obdobje)
    if n < 4:
        return 0.0, 0.0
    zacetki = np.arange(FAZE) * obdobje / FAZE
    koraki = np.arange(n) * obdobje
    tocke = np.clip(zacetki[:, None] + koraki[None, :], 0, len(o) - 1)
    dno = np.floor(tocke).astype(np.int64)
    odstop = tocke - dno
    vrh = np.minimum(dno + 1, len(o) - 1)
    vrednosti = (o[dno] * (1 - odstop) + o[vrh] * odstop).mean(axis=1)
    i = int(np.argmax(vrednosti))
    return float(zacetki[i] * SKOK / SR), float(vrednosti[i])


def isci(o, spodaj=60.0, zgoraj=180.0, korak=0.06):
    """Fin pregled cez obmocje, nato izostritev okoli najboljsega."""
    ocena = -1.0
    najboljsi = 0.0
    for bpm in np.arange(spodaj, zgoraj + korak, korak):
        _, v = mreza(o, float(bpm))
        if v > ocena:
            najboljsi, ocena = float(bpm), v
    for bpm in np.arange(najboljsi - 0.4, najboljsi + 0.42, 0.02):
        _, v = mreza(o, float(bpm))
        if v > ocena:
            najboljsi, ocena = float(bpm), v
    # Na golem kliku sta mrezi 60 in 120 enako dobri, ker se pokritata.
    # Ce dvojnik pade v clovesko obmocje tipkanja, je to prava izbira:
    # glasbenik na takem posnetku tapka dvakrat hitreje.
    if spodaj <= 2 * najboljsi <= zgoraj:
        _, v = mreza(o, 2 * najboljsi)
        if v >= 0.9 * ocena and najboljsi < 85.0:
            najboljsi *= 2.0
    return najboljsi, ocena


for pot in sys.argv[1:]:
    z = nalozi(pot)
    o = ovojnica(z)
    bpm, steklo = isci(o)
    zamik, _ = mreza(o, bpm)
    povprecje = float(o.mean())
    zaklad = steklo / povprecje if povprecje else 0.0
    print(f"{os.path.basename(pot)}: {len(z) / SR:.0f} s  tempo {bpm:.2f} BPM  "
          f"zamik {zamik:.3f} s  obdobje {60.0 / bpm:.4f} s  zaklad {zaklad:.2f}")
