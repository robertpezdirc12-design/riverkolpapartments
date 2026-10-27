#!/usr/bin/env python3
"""Mutacijski preizkus jezikovnih vrat: vsak spregled napake mora biti ujet.

Vrata, ki nikoli ne padejo, ne varujejo nicesar. Vsaka mutacija je takna, da
prejsnja razlica pregleda ne bi opazila nicesar novega — mrtvo polje, razlica
z napacnim imenom, branje brez prevoda.

raba: python rka-jezik-mutacija.py
"""
import json
import re
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

STR = Path(r"C:\Users\admin\Downloads\sssdf\rka-onepage")
SPOT = STR / "spot.json"
IZV = STR / "zgodba.js"
PREVERI = Path(r"C:\Users\admin\AppData\Local\Temp\rka-jezik-preveri.py")

IZVIRNI = {SPOT: SPOT.read_text(encoding="utf-8"), IZV: IZV.read_text(encoding="utf-8")}


def vrni():
    for pot, besedilo in IZVIRNI.items():
        pot.write_text(besedilo, encoding="utf-8", newline="\n")


def kader(spot, id):
    for k in spot["kadri"]:
        if k["id"] == id:
            return k
    raise SystemExit(f"kadra {id} ni")


def spot_mutiraj(f):
    spot = json.loads(SPOT.read_text(encoding="utf-8"))
    f(spot)
    SPOT.write_text(json.dumps(spot, ensure_ascii=False, indent=1) + "\n",
                    encoding="utf-8", newline="\n")


def izbrisi(polje, id):
    def f(spot):
        k = kader(spot, id)
        if polje not in k:
            raise SystemExit(f"{id}: {polje} ni zapisan")
        del k[polje]
    return f


def preimenuj(iz, v, id):
    def f(spot):
        k = kader(spot, id)
        if iz not in k:
            raise SystemExit(f"{id}: {iz} ni zapisan")
        k[v] = k.pop(iz)
    return f


def nastavi(polje, vrednost, id):
    def f(spot):
        kader(spot, id)[polje] = vrednost
    return f


def dodaj(polje, vrednost, id):
    def f(spot):
        k = kader(spot, id)
        if not isinstance(k.get(polje), list):
            raise SystemExit(f"{id}: {polje} ni seznam")
        k[polje] = k[polje] + [vrednost]
    return f


def besedilo_mutiraj(igla, nadomestilo):
    besedilo = IZV.read_text(encoding="utf-8")
    if besedilo.count(igla) != 1:
        raise SystemExit(f"izvirnika ni najti natanko enkrat ({besedilo.count(igla)}x): {igla}")
    IZV.write_text(besedilo.replace(igla, nadomestilo), encoding="utf-8", newline="\n")


MUTACIJE = [
    ("izbrisan podEn k02", lambda: spot_mutiraj(izbrisi("podEn", "k02"))),
    ("izbrisan ebEn k07", lambda: spot_mutiraj(izbrisi("ebEn", "k07"))),
    ("izbrisane znackeEn k22", lambda: spot_mutiraj(izbrisi("znackeEn", "k22"))),
    ("nova slovenska oznaka brez prevoda",
     lambda: spot_mutiraj(dodaj("znacke", "brez provizije", "k08"))),
    ("podRez izbrisan (k12 se ponovi v 60)",
     lambda: spot_mutiraj(izbrisi("podRez", "k12"))),
    ("podEn brez izvirnika", lambda: spot_mutiraj(izbrisi("pod", "k02"))),
    ("razlicica z napacnim imenom (podEn2)",
     lambda: spot_mutiraj(preimenuj("podEn", "podEn2", "k02"))),
    ("angleksca razlica je pravzaprav slovenska (breznacske)",
     lambda: spot_mutiraj(nastavi("ebEn", "Dve hisi, ena reka", "k07"))),
    ("angleka razlica s slovenskimi znaki",
     lambda: spot_mutiraj(nastavi("znackeEn", ["10 / 10 · 8 mnenj"], "k21"))),
    ("angleki podnaslov kar iz slovenskega izvirnika",
     lambda: spot_mutiraj(nastavi("podEn", "Vsaka hiša svojo", "k12"))),
    ("predvajalnik spet bere golo eb",
     lambda: besedilo_mutiraj('${jezikovno(k, "eb") || ""}', '${k.eb || ""}')),
    ("predvajalnik spet bere golo pod",
     lambda: besedilo_mutiraj('return jezikovno(kader, "pod");', "return kader.pod;")),
    ("predvajalnik ne pozna vec podRez",
     lambda: besedilo_mutiraj("kader.podRez && kader.podRez !== stanje.rez", "true")),
    ("angleka poved je pravzaprav slovenska",
     lambda: spot_mutiraj(nastavi("govorEn", "Dve hisi, dva naslova v Gribljah.", "k07"))),
    ("angleka poved izbrisan, rez pade na slovenski beso",
     lambda: spot_mutiraj(izbrisi("govorEn", "k03"))),
]


def izkusi(mutator):
    """(ujeto, sporocilo): pade mora z izhodno kodo IN z vrsto razcisljivo napako."""
    vrni()
    try:
        mutator()
    except SystemExit as e:
        return False, f"NI IZVEDENA — {e}"
    r = subprocess.run([sys.executable, str(PREVERI)], capture_output=True,
                       text=True, encoding="utf-8", errors="replace")
    vrni()
    javljene = re.findall(r"^\s+-\s+(.*)$", r.stdout, re.M)
    if r.returncode == 0:
        return False, "SPADLO — vrat niso ujela"
    if not javljene:
        return False, f"PORAČENO Z RUŠITVIJO — pregled ni javil nobene napake, izhod {r.returncode}"
    return True, javljene[0][:120]


vrni()
r = subprocess.run([sys.executable, str(PREVERI)], capture_output=True,
                   text=True, encoding="utf-8", errors="replace")
if r.returncode != 0:
    print("IZHODISCE NI V REDU:\n" + r.stdout + r.stderr)
    sys.exit(1)
print("izhodisce: V REDU (brez mutacij)")

napake = []
for ime, mutator in MUTACIJE:
    ujeto, sporocilo = izkusi(mutator)
    if not ujeto:
        napake.append(ime)
        print(f"  {ime}: {sporocilo}")
    else:
        print(f"  {ime}: ujeta — {sporocilo}")

for pot, besedilo in IZVIRNI.items():
    if pot.read_text(encoding="utf-8") != besedilo:
        napake.append(f"obnova {pot.name}")
        print(f"  obnova: {pot.name} ni enak izvirniku")

print(f"\nujetih {len(MUTACIJE) - len(napake)} / {len(MUTACIJE)}")
if napake:
    print("NI UJETO:", ", ".join(napake))
print("jezik: " + ("V REDU" if not napake else "napaka"))
sys.exit(1 if napake else 0)
