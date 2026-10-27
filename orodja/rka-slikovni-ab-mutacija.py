# -*- coding: utf-8 -*-
"""Falsifikacija vrat rka-slikovni-ab.py.

Namen: dokazati, da vsaka trditev slikovnega A/B-dejansko nekaj vidi. Port, ki se
ga nikoli ne da spraviti do padca, ne trdi ničesar — tod je to zlasti pomembno,
ker ista vrsta mere že enkrat tiho zmolčala: z -loglevel error filter teče, a
izpiše nič, in mera bi bila napačna namesto glasno napačna.

Vsaka mutacija zamenja TOČNO določen niz v kopiji vrate; če niz ni edini, harness
ustavi in nič se ne spremeni. Kopija se izvede izvede, original se ne piše.

Preverja se:
  a) kopija pade (neničeln izhod),
  b) pade z pričakovano obrazložitvijo, ne z drugo,
  c) original je po vsem skupaj bitno enak (sha256 pred in po).
"""
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import hashlib, io, os, subprocess, sys

TEMP = os.environ["TEMP"]
VRAZA = os.path.join(TEMP, "rka-slikovni-ab.py")

MUTACIJE = [
    ("loglevel",
     '"-loglevel", "info"', '"-loglevel", "error"',
     "ni izmerjenega YAVG",
     "informacijski kanalo ugasnemo, mera molči — port mora pasti, ne zelenati"),
    ("sama-sebi",
     'VAROVA = os.path.join(REKLAMA, "_pred-gibom-2026-10-26")',
     "VAROVA = REKLAMA",
     "NI prišla do pikslov",
     "primerjava istega posnetka sama sebi sme biti nič, ne zelena"),
    ("prazno",
     'VAROVA = os.path.join(REKLAMA, "_pred-gibom-2026-10-26")',
     'VAROVA = os.path.join(REKLAMA, "_mutacija-ne-obstaja")',
     "izvedenih je samo",
     "brez datotek port ne sme poročati ničesar"),
    ("ploski-identiteta",
     '["rka-60-sl-mojster.mp4", "rka-60-sl-druzbeno.mp4"]',
     '["rka-60-en-splet.mp4", "rka-30-sl-mojster.mp4"]',
     "nimajo istega videa",
     "trditev o skupnem video toku mora padti, če jo vezemo na drugo platno"),
]

original = io.open(VRAZA, encoding="utf-8").read()
vsota_pred = hashlib.sha256(original.encode("utf-8")).hexdigest()

padli = 0
for ime, staro, novo, prica, razlaga in MUTACIJE:
    if original.count(staro) != 1:
        print("%-20s USTAVLJENO: vez '%s' ni edini (%d najdb) — mutacije se ni zgodilo"
              % (ime, staro, original.count(staro)))
        sys.exit(2)
    kopija_pot = os.path.join(TEMP, "rka-slikovni-ab-mut-%s.py" % ime)
    io.open(kopija_pot, "w", encoding="utf-8", newline="\n").write(original.replace(staro, novo))
    r = subprocess.run([sys.executable, kopija_pot], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    izhod = (r.stdout or "") + (r.stderr or "")
    vrstica = next((l for l in izhod.splitlines() if prica in l), "(obrazlozitve ni v izpisu)")
    koda_nicelna = r.returncode == 0
    prico_ujet = prica in izhod
    if not koda_nicelna and prico_ujet:
        padli += 1
        print("%-20s PADLO  izhod=%d  vzrok: %s" % (ime, r.returncode, vrstica.strip()[:110]))
    else:
        print("%-20s NAPAKA mutacija ni padla (izhod=%d, pricovan izpis %s): %s"
              % (ime, r.returncode, "najden" if prico_ujet else "NI najden", razlaga))
    os.remove(kopija_pot)

vsota_po = hashlib.sha256(io.open(VRAZA, encoding="utf-8").read().encode("utf-8")).hexdigest()
print("\nmorilo pasti: %d | padlo: %d | original nespremenjen: %s"
      % (len(MUTACIJE), padli, "DA" if vsota_po == vsota_pred else "NE (" + vsota_pred[:12] + " -> " + vsota_po[:12] + ")"))
if padli != len(MUTACIJE) or vsota_po != vsota_pred:
    sys.exit(1)
print("V REDU: vse %d trditv vrat je videnih padlo, original bitno enak." % len(MUTACIJE))
