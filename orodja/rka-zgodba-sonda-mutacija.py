# -*- coding: utf-8 -*-
"""Falsifikacija NOVE trditve v rka-zgodba-sonda.cjs (zavrtje do dna).

2026-10-27 je sonda v verizi umrla na sirina-320/sl (ostalo 1 px), samostojen
ponovni zagon istega trenutka pa je bil zelen. Vzrok je izmerjen, ne ugiban:
z rka-drs-diagnoza.cjs je bil ob nastavitvi scrollTop status document.fonts še
»loading«; zamenjava pisave je skrčila višino vsebine z 2199 na 2177 px in je
že nastavljeno zavrtje ostalo 1 px nad novim dnom.

Popravek ima dva dela in ta harness meri vsakega posebej:
  M1  zavrtje in branje sta v ISTEM sinhronem bloku (zavrtjiDoDna).
      Mutacija: zavrti 40 px premalo. Mora pasti z novo obrazložitvijo.
      Če trditev ne vidi 40 px, je okrasje.
  M2  CakajPisave pred zavrtjem.
      Te mutacije NI mogoče deterministično ujeti: v samostojnem zagonu so
      pisave do takrat že naložene, zato vrata brez čakanja NE padejo.
      Zato je M2 zapisana kot NEZAJETO — mehanizem je dokazan samo s
      ponovljenim vzorcem v diagnozi (11 od 12 vzorcev ostanek 1,000 px),
      ne z mutacijo.

Vsaka mutacija teče na KOPIJI; izvirnik se ne spremeni (prevereno s sha256).
"""
import hashlib
import io
import os
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

TEMP = os.environ["TEMP"]
IZVIRNIK = os.path.join(TEMP, "rka-zgodba-sonda.cjs")

MUTACIJE = [
    ("M1-zavrtje-40-px-premalo",
     "    b.scrollTop = b.scrollHeight;\n",
     "    b.scrollTop = b.scrollHeight - b.clientHeight - 40;\n",
     "pomirjeni postavitvi"),
]

# Prvi poskus mutacije je bil odštetek "b.scrollHeight - 40" in je ostal ZELENA:
# odštevek od scrollHeight še vedno preseže največji zavrtje (scrollHeight -
# clientHeight), brskalnik ga zreže na rob, panel pa je na dnu kljub temu.
# Ničelna mutacija, poročana kot uspeh, je najslabši možen izid harnessa, zato
# mora pot do dna odštevati OD NAJVEČJEGA ZAVRTJA.
#
# Drugi poskus je padel, a z drugo obrazložitvijo, kot smo pričakovali: sid je
# bil "niso dotaknila dna", padlo pa je BESEDILO. Pri telefonu vrata sploh ne
# drsijo (največji zavrtje je 0), zato mutacija tam ne more biti vidna, vidna
# je lahko samo na panelu z besedilom. Obe trditvi uporabita isti pomočnik
# zavrtjiDoDna, zato sid pokriva njuno skupno obrazložitev »pomirjeni
# postavitvi« — padec z drugim razlogom je po naši merilu še vedno
# nepričakovan izid in ga harness ne sme šteti kot ujetega.

NEZAJETO = [
    ("M2-brez-cakanja-na-pisave",
     "samostojen zagon ima pisave že naložene, zato vrata brez CakajPisave NE "
     "padejo; mehanizem je dokazan le s ponovljenim vzorcem v diagnozi"),
]


def sha256(pot):
    with open(pot, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


pred = sha256(IZVIRNIK)
z_vsebino = open(IZVIRNIK, encoding="utf-8").read()

uspeha = 0
for oznaka, vzorec, zamenjava, pricka in MUTACIJE:
    if z_vsebino.count(vzorec) != 1:
        print("%-28s PREKINITEV: vez ni edina (najdena %d-krat)"
              % (oznaka, z_vsebino.count(vzorec)))
        continue
    kopija = os.path.join(TEMP, "rka-zgodba-sonda-mut-%s.cjs" % oznaka)
    with io.open(kopija, "w", encoding="utf-8") as f:
        f.write(z_vsebino.replace(vzorec, zamenjava))
    r = subprocess.run(["node", kopija],
                       capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=900)
    izhod = (r.stdout or "") + (r.stderr or "")
    padlo = r.returncode != 0 and pricka in izhod
    vzrok = next((v.strip()[:160] for v in izhod.splitlines() if "SMRT:" in v), "")
    print("%-28s %s  izhod=%d  %s" % (oznaka, "PADLO" if padlo else "NI PADLO",
                                      r.returncode, vzrok))
    if padlo:
        uspeha += 1
    else:
        print("      pričakovali smo razlago, ki vsebuje %s" % repr(pricka))
    try:
        os.remove(kopija)
    except OSError:
        pass

for oznaka, razlog in NEZAJETO:
    print("%-28s NEZAJETO: %s" % (oznaka, razlog))

po = sha256(IZVIRNIK)
print("\nmorilo pasti: %d | padlo: %d | nezajetih: %d | izvirnik bitno enak: %s"
      % (len(MUTACIJE), uspeha, len(NEZAJETO),
         "DA" if po == pred else "NE (%s -> %s)" % (pred[:8], po[:8])))
if uspeha != len(MUTACIJE) or po != pred:
    sys.exit(1)
print("V REDU: nova trditev o zavrtju je videnih padla, izvirnik nedotaknjen.")
