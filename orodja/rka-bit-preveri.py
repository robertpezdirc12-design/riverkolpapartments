# Preveri, da casovni list res sedi na utripih in da pripoved stane v oba jezika.
#
# raba: python rka-bit-preveri.py <rez> <pot-do-lista.json>
#
# Kontrola je ločena od razporedjevalnika: bere JSON in seznam.json in se ne spomni
# nobene številke iz prejšnjega koraka. Z njo lahko pregledaš tudi star list, da
# vidiš, ali kontrola sploh zna odpovedati.
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SPLAT = r"C:\Users\admin\Downloads\sssdf\rka-onepage"
ZRAK_MIN = 0.30   # najmanjši zrak, ki ga spoštuje tudi rka-glas.py


def govor(rez, jezik):
    with open(os.path.join(SPLAT, "zvok", f"{rez}-{jezik}", "seznam.json"),
              encoding="utf-8") as f:
        return {l["kader"]: l["govor"] for l in json.load(f)["linie"]}


rez = sys.argv[1]
pot = sys.argv[2] if len(sys.argv) > 2 else os.path.join(SPLAT, "spot.json")
with open(pot, encoding="utf-8") as f:
    m = json.load(f)
napisi = m["rezi"][rez]
enota = float(napisi["dolzina"])
bit = napisi.get("bit")

gs, ge = govor(rez, "sl"), govor(rez, "en")
tekoce = 0.0
napake = []
if bit:
    utrip = 60.0 / bit["bpm"]
    print(f"mreza: {bit['bpm']:g} BPM, utrip {utrip * 1000:.1f} ms")
else:
    utrip = None
    napake = ["rez nima časovnega lista utripov (bit) — reži ne morejo slediti tempu"]

for kid, okno in napisi["niz"]:
    zacetek = tekoce
    naj = max(gs.get(kid, 0.0), ge.get(kid, 0.0))
    for jezik, g in (("sl", gs.get(kid, 0.0)), ("en", ge.get(kid, 0.0))):
        if g is None:
            continue
        if okno - g < ZRAK_MIN:
            napake.append(f"{kid}/{jezik}: okno {okno:.3f} s, govor {g:.2f} s, "
                          f"zrak samo {okno - g:.2f} s < {ZRAK_MIN} s")
    ce = None if utrip is None else okno / utrip
    na_utrip = utrip is not None and abs(ce - round(ce)) < 1e-6
    robov = None if utrip is None else zacetek / utrip
    na_rob = utrip is None or abs(robov - round(robov)) < 1e-6
    if utrip is not None and not (na_utrip and na_rob):
        napake.append(f"{kid}: rez ob {zacetek:.3f} s ni na utripu "
                      f"(okno {okno:.3f} s = {ce:.3f} utripa)")
    print(f"  {kid}  {zacetek:>7.3f} -> {zacetek + okno:>7.3f} s  "
          f"{okno:>7.3f} s  {('%.0f utripov' % ce) if utrip else '—':>11}  "
          f"zrak {okno - naj:>5.2f} s")
    tekoce += okno

print(f"\nvsota {tekoce:.5f} s / enota {enota} s")
if abs(tekoce - enota) > 0.005:
    napake.append(f"vsota oken {tekoce:.3f} s != enota {enota} s")
if napake:
    print("\nREZ NI SKLADEN:")
    for n in napake:
        print("  - " + n)
    raise SystemExit(1)
print(f"\nOK: vsi reži so na utripu, okna se seštejejo v dolžino enote, in oba "
      f"jezika imata v vsakem kadru vsaj {ZRAK_MIN} s zraka.")
