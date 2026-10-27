#!/usr/bin/env python3
# Mutacijski pregled A/B sonde: sonda je verodostojna Ste, ko jo vidimo pasti.
# Generator za cas vsake mutacije dobi eno samo napako; nato se besedilo vrne in
# stran se zgradi na novo. Mutacija, ki v generatorju ne najde vzorca, ni dokaz
# ampak prazen obrok, zato jo javimo kot napako in ne kot uspeh.
#
#   raba: python rka-ab-mutacija.py
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import os, subprocess, sys

TEMP = os.environ["TEMP"]
GEN = os.path.join(TEMP, "rka-ab-naredi.py")
izvirnik = open(GEN, encoding="utf-8").read()

MUTACIJE = [
    ("razvrsenost na naopak", "rows.sort(key=lambda r: r[\"t\"])",
     "rows.sort(key=lambda r: -r[\"t\"])"),
    ("povrdena oznaka <tabela>", "<table class=tabela>", "<tabela>"),
    ("dolzina ne zamenja vira", "  nastaviVir(0);\n", ""),
    ("skok brez zamika", "prestavi(Math.max(0, t - 1.0));", "prestavi(Math.max(0, t));"),
    ("gumb A ostane neozicen", 'ga.setAttribute("aria-pressed", String(dat === "A"));',
     'ga.setAttribute("aria-pressed", "false");'),
    ("puzcica desno ne premakne", "z.currentTime + 1));", "z.currentTime));"),
    ("lestvica brez mer", "for (let t = 0; t <= E[stanje.rez]; t += korak) {{",
     "for (let t = 0; t < 0; t += korak) {{"),
]


def izgradi():
    subprocess.run([sys.executable, GEN], check=True, capture_output=True)


def sonda():
    r = subprocess.run(["node", os.path.join(TEMP, "rka-ab-sonda.cjs")],
                       capture_output=True, text=True, encoding="utf-8", errors="replace",
                       cwd=TEMP, timeout=600)
    izhod = r.stdout or ""
    if "KONEC " not in izhod:              # sonda je zaparala: brez izpisa ni nic dokazanega
        return None, (r.stderr or "").strip().replace("\n", " ")[:150]
    padli = [l.split(" ", 1)[1].split(":")[0].strip()
             for l in izhod.splitlines() if l.startswith("NAPA ")]
    return padli, ""


napoved = []
for ime, staro, novo in MUTACIJE:
    if staro not in izvirnik:
        print(f"{ime:28} NAPACNA MUTACIJA: v generatorju ne najdem vzorca")
        napoved.append((ime, "vzorec"))
        continue
    open(GEN, "w", encoding="utf-8").write(izvirnik.replace(staro, novo, 1))
    izgradi()
    padli, napaka = sonda()
    if padli is None:
        print(f"{ime:28} NI DO KONCA ZAPARALO: {napaka}")
        napoved.append((ime, "zapov"))
        continue
    print(f"{ime:28} padlo {len(padli):>2}: {', '.join(padli) if padli else 'NIC — preizkus je slep'}")
    napoved.append((ime, padli))

open(GEN, "w", encoding="utf-8").write(izvirnik)
izgradi()
padli, napaka = sonda()
print("\nvrnjeno stanje: " + ("zeleno" if padli == [] else
      f"PADLO {padli}" if padli else f"sonda ni zaparala: {napaka}"))
slep = [i for i, p in napoved if p == []]
krivi = [i for i, p in napoved if p in ("vzorec", "zapov")]
print(f"mutacij {len(napoved)}; pokritih {len(napoved) - len(slep) - len(krivi)}; "
      f"slepih {len(slep)}" + (f" -> {', '.join(slep)}" if slep else "") +
      f"; neopravljenih {len(krivi)}" + (f" -> {', '.join(krivi)}" if krivi else
      "; vsaka opravljena mutacija je vsaj en preizkus spravila do napake"))
