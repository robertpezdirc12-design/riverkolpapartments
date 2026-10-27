# -*- coding: utf-8 -*-
"""Gib v pilotu proti odobrenemu mojstru: ista časovnica, isti cevovod, različen
posnetek.

Vprašanje: ali datoteka, ki jo bo Robert pogledal, v resnici nosi ublažen gib in
sunek ob rezu — ali je kader v njej enak kot v že odobrenih izdelkih. Trditev,
sestavljena iz ure datoteke in zaporedja urejanj, je sklepanje. To je mera.

Način: okvirje razgrni v sivine in izračunaj srednjo absolutno razliko med
sosednjima okvirjema. Pri majhnem pomiku je sorazmerna hitrosti kamere. Meje
med kadri se NE išče po pragu (prehod 0,30 s zabriše skok), ampak se vzamejo iz
časovnega lista; prvi 0,30 s vsakega kadra se označi kot prehod in loči od
hoje.

Kontroli:
  k01 je video in giba nima (gib = "ni") — če mera tam pokaže hitrost hoje,
  meri zrnatost in ne kamere.
  mojster rka-60-sl-mojster.mp4 je iz istega cevovoda, a iz časa pred živostjo:
  linearna hoja, brez suneka. Razlika med pilotom in mojstrom je torej učinek
  živosti in nič drugega.

Ublažitev e'(t) = 1 − 0,45·cos(2πt) napove razmerje med hitrostjo na sredini
okna in hitrostjo na njegovih četrtinskih robovih 1,29 : 0,71 ≈ 1,80. Linearna
hoja napove 1,00.

Ni vrata: izpiše številke in napoved, sam o njih ne sodi.
  raba: python rka-pilot-gib.py <pilot.mp4> <mojster.mp4> [zacetek_okna_s] [rez] [dolzina_s]
"""
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json, subprocess, sys
import numpy as np

FF = r"C:\Users\admin\.qoder\bin\ffmpeg.exe"
SPLAT = r"C:\Users\admin\Downloads\sssdf\rka-onepage"
SPOT = json.load(open(SPLAT + r"\spot.json", encoding="utf-8"))
SRICJE = 30
Š, V = 480, 270
TRAJANJE_REZA = 0.30         # REZ_TRAJANJE v zgodba.js
UBLAG = 0.45
GRADIENT = 5.0               # groba ocena |dI/dx| sivin na px, za pretvorbo v px


def profil(pot, pomik, zacetek, dolzina):
    r = subprocess.run(
        [FF, "-hide_banner", "-loglevel", "error", "-ss", str(pomik), "-t", str(dolzina),
         "-i", pot, "-vf", f"scale={Š}:{V}:flags=bicubic,format=gray",
         "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"], capture_output=True)
    if r.returncode != 0:
        raise SystemExit("ffmpeg ni razgrnil " + pot + ": "
                         + r.stderr[-300:].decode("utf-8", "replace"))
    a = np.frombuffer(r.stdout, dtype=np.uint8)
    if a.size % (Š * V) or a.size == 0:
        raise SystemExit("surov tok ni celih okvirjev: " + pot)
    a = a.reshape(-1, V, Š).astype(np.int16)
    return np.abs(a[1:] - a[:-1]).mean(axis=(1, 2)), len(a)


def casovnica(rez_id):
    giba = {k["id"]: k.get("gib") for k in SPOT["kadri"]}
    t, okna = 0.0, []
    for kid, w in SPOT["rezi"][rez_id]["niz"]:
        okna.append((kid, t, w, giba.get(kid), SPOT["kadri"]))
        t += w
    vrsta = {k["id"]: k["vrsta"] for k in SPOT["kadri"]}
    return [(k, t0, w, g, vrsta[k]) for k, t0, w, g, _ in okna]


def e(t):
    return t - UBLAG / (2 * np.pi) * np.sin(2 * np.pi * t)


def tretjine(d, i0, i1):
    """Hitrost hoje po tretjinah okna, brez first REZ_TRAJANJE."""
    a = int(round(i0 + TRAJANJE_REZA * SRICJE))
    b = int(round(i1))
    if b - a < 9:
        return None
    kos = d[a:b]
    t = len(kos) // 3
    prva, sredina, zadnja = kos[:t].mean(), kos[t:2 * t].mean(), kos[-t:].mean()
    robovi = (prva + zadnja) / 2
    return dict(okv=len(kos), zacetek=a / SRICJE, prva=prva, sredina=sredina,
                zadnja=zadnja, razmerje=(sredina / robovi if robovi > 0.05 else None))


def main():
    pilot, mojster = sys.argv[1], sys.argv[2]
    zacetek = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0
    rez_id = sys.argv[4] if len(sys.argv) > 4 else "60"
    dolzina = float(sys.argv[5]) if len(sys.argv) > 5 else 6.0
    okna = casovnica(rez_id)
    # Pilotna datoteka se začne pri `zacetek` (izvoznik izreže okno), zato se
    # premakne za 0; mojster je cela minuta in se mora premakniti toliko, da
    # oba vzorčita isti kos časovnice.
    dp, np_ = profil(pilot, 0.0, zacetek, dolzina)
    dm, nm = profil(mojster, zacetek, zacetek, dolzina)
    print(f"merilni razrez {Š}x{V} px (1 enota = {1920 // Š} px platna), "
          f"okno {zacetek:.2f}–{zacetek + dolzina:.2f} s celote")
    print(f"pilot {np_} okvirjev, mojster {nm} okvirjev")
    rob = ((e(.25) - e(0)) / .25 + (e(1.) - e(.75)) / .25) / 2
    print(f"napoved: ublažena hoja sredina/rob ~ {(e(.75) - e(.25)) / .5 / rob:.2f}, "
          f"linearna hoja 1,00")
    print()
    print("  kader  vrsta  gib    okno(pilot)      pilot: prva/sred/zadn  razmerje | mojster: prva/sred/zadn  razmerje")
    for kid, t0, w, gib, vrsta in okna:
        a = (t0 - zacetek) * SRICJE
        b = a + w * SRICJE
        if a < -1 or b > len(dp):
            continue
        p = tretjine(dp, max(a, 0), b)
        m = tretjine(dm, max(a, 0), b)
        if not p or not m:
            continue
        fmt = lambda x: f"{x['prva']:5.2f}/{x['sredina']:5.2f}/{x['zadnja']:5.2f}"
        rat = lambda x: (f"{x['razmerje']:5.2f}" if x['razmerje'] else "   /")
        print(f"  {kid}    {vrsta:6} {str(gib):5}  "
              f"{max(a, 0) / SRICJE:5.2f}-{b / SRICJE:5.2f} s  "
              f"{fmt(p)}   {rat(p)}   |  {fmt(m)}   {rat(m)}")
    print()
    # Kadri brez giba kamere (gib = "ni"): vsak skoraj ničelna razlika med
    # sosednjima okvirjema je podvojen okvir izvornega posnetka, ne mirujoča
    # kamera. Velja za vsak tak kader, ki ga okno sploh vsebuje.
    for kid, t0, w, gib, vrsta in okna:
        if gib != "ni":
            continue
        a = int(round(max(t0 - zacetek, 0.0) * SRICJE)) \
            + int(round(TRAJANJE_REZA * SRICJE))   # prehod vsebuje rez, ne kadra
        b = int(round(min(t0 + w - zacetek, dolzina) * SRICJE))
        if b - a < 2:
            print(f"{kid} (gib = ni): okno {zacetek:.2f}–{zacetek + dolzina:.2f} s "
                  f"od tega kadra ne vsebuje ničesar razen prehoda — podvojenih "
                  f"okvirjev v njem ni mogoče šteti.")
            continue
        for ime, d in (("pilot", dp), ("mojster", dm)):
            if b > len(d):
                print(f"{kid} {ime}: toka zmanjka (raba {b}, je {len(d)} okvirjev) — "
                      f"podvojenih okvirjev nisem mogel prešteti")
                continue
            kos = d[a:b]
            n = int((kos < 0.10).sum())
            print(f"{kid} (gib = ni), {ime}: {n} podvojenih od {len(kos)} okvirjev "
                  f"({100.0 * n / len(kos):.1f} %)")
    print("KONEC")



main()
