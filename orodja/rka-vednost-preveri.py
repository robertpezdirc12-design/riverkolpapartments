# -*- coding: utf-8 -*-
"""Utrljen preverjanje: v tabeli MUTACIJE mora biti vsak izvirnik prisoten
natanko enkrat in vsaka mutacija odsotna — sicer je chain pustil sled v
izdelkih. Branje samo, nič ne piše."""
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import io, os, sys

H = os.environ["TEMP"] + r"\rka-gib-mutacija.py"
src = io.open(H, encoding="utf-8").read()
ns = {}
exec(src[: src.index("def ")], {"__name__": "x"}, ns)          # uvozi in konstante
zacetek = src.index("MUTACIJE = [")
konec = src.index("\n]", zacetek) + 2
exec(src[zacetek:konec], ns, ns)                               # sama tabela
RKA = ns["RKA_DIR"]
SONDA = ns["SONDA"]

slabo = 0
for ime, dat, iz, na, _ in ns["MUTACIJE"]:
    pot = SONDA if dat == "sonda" else os.path.join(RKA, dat)
    b = io.open(pot, encoding="utf-8").read()
    ni, nn = b.count(iz), b.count(na)
    ok = ni == 1 and nn == 0
    slabo += 0 if ok else 1
    print("%-11s %s  izvirnikov %d, mutacij %d  %s"
          % (ime, "OK  " if ok else "SLEP", ni, nn, os.path.basename(pot)))
print("SKUPAJ slabih: %d" % slabo)
print("KONEC")
sys.exit(1 if slabo else 0)
