#!/usr/bin/env python3
"""V spot.json doda angleške razlicice neizgovorjenega besedila (naslovec,
podnaslov, oznake) in omejitev podnaslova na eno samo enoto.

Vsak zapis je pogojen z izvirnikom: ce polja ni, skript pade, ne tiho preskoci.
"""
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json
from pathlib import Path

POT = Path(r"C:\Users\admin\Downloads\sssdf\rka-onepage\spot.json")
SLOVENSKINE = ("eb", "pod", "znacke")

# (kader, polje, vrednost) — "En" = angleška razlicica, brez nje izpis ostane
# slovenski; "Rez" = podnaslov velja samo za to enoto.
DODAJ = [
    ("k02", "podEn", "to the natural bathing spot on the Kolpa"),
    ("k07", "ebEn", "Two houses, one river"),
    ("k08", "znackeEn", ["apartment for 7 guests", "studio for 5 guests"]),
    ("k11", "znackeEn", ["oven and stove", "washing machine"]),
    ("k12", "podRez", "30"),
    ("k12", "podEn", "Every house has its own"),
    ("k15", "znackeEn", ["fenced"]),
    ("k21", "znackeEn", ["10 / 10 · 8 reviews"]),
    ("k22", "znackeEn", ["majda.pezdirc@gmail.com",
                         "Booking.com — no commission",
                         "10/10 · 8 reviews"]),
]

izvir = POT.read_text(encoding="utf-8")
spot = json.loads(izvir)
kadri = {k["id"]: k for k in spot["kadri"]}

for id, polje, vrednost in DODAJ:
    k = kadri.get(id)
    if k is None:
        raise SystemExit(f"NEZNAN KADER {id}")
    osnova = "pod" if polje == "podRez" else polje[:-2]
    if osnova not in k:
        raise SystemExit(f"{id}: polja {osnova!r} ni, razlicice {polje!r} ni kaj dodajati")
    if polje in k:
        raise SystemExit(f"{id}: {polje} je ze zapisan")
    if osnova == "znacke":
        if not isinstance(k["znacke"], list) or len(k["znacke"]) != len(vrednost):
            raise SystemExit(f"{id}: znackeEn mora imeti enako stevilo kot znacke")
    k[polje] = vrednost

for k in spot["kadri"]:
    for osnova in SLOVENSKINE:
        en = osnova + "En"
        if en in k and osnova not in k:
            raise SystemExit(f"{k['id']}: {en} brez izvirnika {osnova}")
        if en in k and isinstance(k[osnova], list) and len(k[osnova]) != len(k[en]):
            raise SystemExit(f"{k['id']}: {en} ni enako dolga kot {osnova}")

nova = json.dumps(spot, ensure_ascii=False, indent=1) + "\n"
if nova == izvir:
    raise SystemExit("spot.json se ni spremenil")
POT.write_text(nova, encoding="utf-8", newline="\n")
print(f"vnosenih razlicic: {len(DODAJ)}")
for id, polje, vrednost in DODAJ:
    print(f"  {id}.{polje} = {vrednost!r}")
