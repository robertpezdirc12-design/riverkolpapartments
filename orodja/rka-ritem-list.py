# Razporedi okna kadrov na utripe izbrane skladbe in preveri, da vrstica stane.
#
# raba: python rka-ritem-list.py <rez> <bpm> [--zrak=0.35] [--upisi]
#
# Zasnova: dolžina spota je pri 128 BPM točno 128 utripov oziroma 32 taktov,
# zato vsako okno znaša celo število utripov in rez pade na utrip.
#
# Prioriteta dodatnega prostora (v tem vrstnem redu, dokler niso porabljeni vsi
# utrip): zadnji kadar (poziv), začetek spota, glave poglavij, nato kadri z
# najdaljšim govorom. Srednji del ostane tesen, robovi dihajo — kontrast je
# tisto, kar sredino pusti videti hitro.
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json
import math
import os
import shutil
import sys

SPLAT = r"C:\Users\admin\Downloads\sssdf\rka-onepage"
GLAVNI = ["k01", "k07", "k11", "k19", "k21"]       # prvi kader vsakega poglavja
ZADNJI = "k22"


def govor(rez, jezik):
    pot = os.path.join(SPLAT, "zvok", f"{rez}-{jezik}", "seznam.json")
    with open(pot, encoding="utf-8") as f:
        s = json.load(f)
    return {l["kader"]: l["govor"] for l in s["linie"]}


def razporedi(naj, utrip, zrak, dolzina):
    """-> (število utripov na kader, opis) ali (Nic, razlog)."""
    stevilo = sum(math.ceil((v + zrak) / utrip) for v in naj.values())
    if stevilo * utrip > dolzina + 1e-9:
        return None, f"najkrajši možni list {stevilo * utrip:.2f} s presega {dolzina} s"
    # Prednostna vrsta mora biti omejena na kadre, ki so v tem rezu: :30 ima drug
    # seznam kadrov kot :60, sicer razporedjevalec potegne v vrsto kader, ki ga ni,
    # in pade na neobstoječem ključu.
    prednostni = [ZADNJI] + GLAVNI + [k for k in sorted(naj, key=lambda k: naj[k], reverse=True)
                                      if k != ZADNJI and k not in GLAVNI]
    vrsta = [k for k in dict.fromkeys(prednostni) if k in naj]
    vseci = {k: 0 for k in naj}
    i = 0
    while stevilo < dolzina / utrip:
        vseci[vrsta[i % len(vrsta)]] += 1
        stevilo += 1
        i += 1
    return {k: math.ceil((naj[k] + zrak) / utrip) + vseci[k] for k in naj}, "v redu"


rez = sys.argv[1]
bpm = float(sys.argv[2])
zrak = float(next((a.split("=", 1)[1] for a in sys.argv[3:]
                   if a.startswith("--zrak=")), 0.35))
upisi = "--upisi" in sys.argv
utrip = 60.0 / bpm

m = json.load(open(os.path.join(SPLAT, "spot.json"), encoding="utf-8"))
napisi = m["rezi"][rez]
dolzina = float(napisi["dolzina"])
star = dict(napisi["niz"])
kadri = [k for k, _ in napisi["niz"]]
gs, ge = govor(rez, "sl"), govor(rez, "en")
naj = {k: max(gs.get(k, 0.0), ge.get(k, 0.0)) for k in kadri}

utripovi, razlog = razporedi(naj, utrip, zrak, dolzina)
if utripovi is None:
    raise SystemExit(f"NAPAKA: {razlog}")

print(f":{rez}  {bpm:g} BPM  utrip {utrip * 1000:.1f} ms  "
      f"{dolzina / utrip:.0f} utripov = {dolzina / utrip / 4:.0f} taktov  ({razlog})")
print(f"  najmanjši zrak {zrak} s  |  govor zapolni "
      f"{sum(naj.values()) / dolzina * 100:.1f} % platna")
skupaj = 0.0
for kid in kadri:
    okno = utrip * utripovi[kid]
    skupaj += okno
    print(f"  {kid:<6}{star[kid]:>7.2f} -> {okno:>8.5f} s  "
          f"{utripovi[kid]:>3d} utripov  zrak {okno - naj[kid]:>5.2f} s")
print(f"  VSOTA {skupaj:.5f} s / enota {dolzina} s")
if abs(skupaj - dolzina) > 0.005:
    raise SystemExit("NAPAKA: vsota oken ne ustreza enoti.")

if upisi:
    rezerva = os.path.join(os.environ["TEMP"], "spot.json.pred-bitmap")
    if not os.path.exists(rezerva):
        shutil.copy2(os.path.join(SPLAT, "spot.json"), rezerva)
    napisi["niz"] = [[k, round(utrip * utripovi[k], 5)] for k in kadri]
    napisi["bit"] = {"bpm": bpm, "utrip_ms": round(utrip * 1000, 1),
                     "utripovi": {k: utripovi[k] for k in kadri}}
    with open(os.path.join(SPLAT, "spot.json"), "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=1)
        f.write("\n")
    novi = sum(v for _, v in napisi["niz"])
    print(f"  vpisano v spot.json, vsota {novi:.5f} s (rezerva: {rezerva})")
