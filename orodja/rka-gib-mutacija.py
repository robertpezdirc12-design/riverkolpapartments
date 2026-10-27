# -*- coding: utf-8 -*-
"""Falsifikacija vrat rka-gib-sonda.cjs.

Namen: dokazati, da vsa sedem trditev vrate dejansko nekaj vidijo, in izmeriti
sobnost vsake. Vrate, ki se jih nikoli ni dalo spraviti do padca, so okrasje.

Mutacije so vezane na točno določeno vrstico produkta (zgodba.js, zgodba.css) ali
sonde same; vez je edini, prekopano po celem datoteki, sicer se ustavi in nic se ne
sprmeni. Vsaka mutacija mora
  a) pasti (sonda izpiše KONEC + vsaj eno napako),
  b) pasti z obrazložitvijo, ki jo pričakujemo, ne z drugo,
  c) ne sme sprožiti še kake druge trditve (razen v naprej dovoljenih sohibnikov),
  d) vrniti datoteko v baytes identično prvotnik.

Kaj TA harness dokaže tudi: smer prehoda (SMER_PREHODA, skriti, reznica) je od
2026-10-26 vezana na svojo meritev v osmi trditvi, zato njena obrnitev pade.
Pred tem je bila vrzel, ne rezultat, in je bila zapisana med zadetki kot NEZAJETO.
"""
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import io, os, subprocess, sys, hashlib

RKA_DIR = r"C:\Users\admin\Downloads\sssdf\rka-onepage"
SONDA = os.path.join(os.environ["TEMP"], "rka-gib-sonda.cjs")

# Za vsako mutacijo: trditev, KI MORA pasti, in trditve, ki smejo pasti zraven.
# Sočasni zadetki niso napaka: mutacija, ki izklopi ves gib, podere kar pet
# trditev naenkrat — harness torej zahteva DETERMINIZEM, preostale samo tolerira.
OCAKVANO = {
    "ROBA": ["KONC"],          # amplituda roke čez 0,42 % vidi KONC, ne ROB
    "ODMEV": ["KONC"],         # prevelik odmev na rezu vidi vez na zacetku okna
    "SMER": ["SMER"],           # osma trditev meri clip-path in vodno črto
    "ZAMIK": ["KONC"],
    "LINEAR": ["UTRIP"],
    "NICELNI": ["DETERMINIZEM", "ROB", "KONC", "UTRIP"],
    "PORIV": ["PORIV"],
    "PRESLIKAVA": ["PRESLIKAVA", "ROB"],
}
TRDITVE = ("ROB", "PORIV", "PRESLIKAVA", "KONC", "UTRIP", "DETERMINIZEM", "ŽIVA STRAN", "SMER")
MEJA = 0x7FFFFFFE

# Lastni dnevnik korakov. Tri verze so zdehte brez sledu: stdout je bil v
# bloknem pomnilniku, sistemski dnevnik pa ne pozna ne uboja ne zruka. Dokler
# harness ne ve, kje je umrl, je vsak njegav "nisi zajeto" nevreden.
DNEVNIK = os.path.join(os.environ["TEMP"], "gib-harness-dnevnik.txt")

def belezi(bes):
    with io.open(DNEVNIK, "a", encoding="utf-8") as f:
        import datetime
        f.write(datetime.datetime.now().strftime("%H:%M:%S") + " " + bes + "\n")

try:
    import faulthandler
    _fh = io.open(DNEVNIK, "a", encoding="utf-8")
    faulthandler.enable(file=_fh, all_threads=True)
except Exception:
    pass

def razcleni(besedilo, koda):
    """Vrsta (ime izpisa, oznake napak). Razbije celoten izpis, ne samo vrstic, ki
    se zacnejo z znano trditvijo: poduka okolja (progi port, padel Chrome) je treba
    lociti od padca trditve, sicer harness pove 'Ni ujetih' namesto 'Nisem znaval
    meriti'."""
    if "KONEC" not in besedilo:
        return ("smrt", ["ni KONEC znaka"], besedilo)
    if "V REDU" in besedilo and koda == 0:
        return ("cist", [], besedilo)
    if "NI V REDU:" in besedilo or "SMRT:" in besedilo:
        sporo = [v.strip() for v in besedilo.splitlines() if "NI V REDU:" in v or "SMRT:" in v]
        return ("okolje", sporo or ["izhod " + str(koda)], besedilo)
    if "--- SLABO ---" in besedilo:
        jedro = besedilo.split("--- SLABO ---", 1)[1].split("KONEC", 1)[0]
        oznake = []
        for vrstica in jedro.splitlines():
            v = vrstica.strip()
            if not v or v.startswith("... in se"):
                continue
            najdena = next((t for t in TRDITVE if v.startswith(t + " ")), None)
            if not najdena and ":" in v and v.split(":")[0].count(" ") < 4:
                najdena = "POZNASVANJE"      # npr. 'izvoz ...: izmerjenih 8 od 20'
            oznake.append(najdena or "NEZNANO " + v[:60])
        return ("trditve", sorted(set(oznake)), besedilo)
    return ("okolje", ["izhod " + str(koda) + " brez SLABO bloka"], besedilo)

def zzen(besedilo, koda):
    return razcleni(besedilo, koda)[1]

def zazeni_sondo(ime, poskusi=3):
    for st in range(1, poskusi + 1):
        # Dnevnik se zapre in sprazni za vsako vrsto posebej. Kadar postupek
        # zunanji dejavnik ugasne sproti, je zadnja vrsta edini dokaz, kje je
        # stal — stdout bloka se v takem primeru nikoli ne sprazni.
        belezi("klic " + ime + " poskus " + str(st))
        r = subprocess.run([os.environ.get("NODE_EXE", "node"), SONDA],
                           cwd=RKA_DIR, capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        belezi("vraceno " + ime + " poskus " + str(st) + " koda=" + str(r.returncode)
               + " stdout=" + str(len(r.stdout)) + " B stderr=" + str(len(r.stderr)) + " B")
        # Napaka Nodea gre na stderr, izpis trditev na stdout. Kadar se proga
        # ubije sama (padel Chrome, razpokana predloga), je stdout prazen in bi
        # harness trdil le "izhod 1 brez SLABO bloka" — brez vzroka. Zato se
        # oba toka zapišeta in stdout posebej razčleni: zadnjih 400 znakov
        # stderra je del oznake, ne le del datoteke.
        besedilo = r.stdout + (("\n[stderr] " + r.stderr.strip()[-400:])
                               if r.stderr.strip() else "")
        razcleni_r = razcleni(r.stdout, r.returncode)
        io.open(os.path.join(os.environ["TEMP"], "gib-mut-" + ime + ".txt"), "w",
                encoding="utf-8").write(besedilo)
        vrsta, oznake = razcleni_r[0], razcleni_r[1]
        if vrsta != "okolje":
            return vrsta, oznake, r.returncode, st
        if r.stderr.strip():
            oznake = oznake + ["stderr: " + r.stderr.strip().splitlines()[-1][:90]]
        print("  " + ime.ljust(12) + "POKUS " + str(st) + "/" + str(poskusi)
              + ": okolje odpovedalo (" + "; ".join(oznake)[:120] + ")", flush=True)
        import time; time.sleep(6)
    return vrsta, oznake, r.returncode, poskusi

def spusti(datoteka):
    return hashlib.sha256(io.open(datoteka, "rb").read()).hexdigest()

def preberi(datoteka):
    return io.open(datoteka, encoding="utf-8").read()

def zapisi(datoteka, besedilo):
    io.open(datoteka, "w", encoding="utf-8", newline="").write(besedilo)

def prikaz(niz, dolzina=78):
    return repr(niz[:dolina] + ("..." if len(niz) > dolzina else ""))

def zadeti(cilj):
    return SONDA if cilj == "sonda" else os.path.join(RKA_DIR, cilj)

MUTACIJE = [
    ("ROBA", "zgodba.js",
     "const ROKA_X = 0.28, ROKA_Y = 0.20;",
     "const ROKA_X = 1.90, ROKA_Y = 1.40;",
     "1,9-odstotna roka mora pasti na mejah zamika KONC in ne na ROB "
     "(platno ima 8-odstotni nadrob, zato ROBa gib ne more razkriti)"),
    ("ODMEV", "zgodba.js",
     "const PI_AMPL = 0.016;",
     "const PI_AMPL = 0.060;",
     "6-odstoten sunek na rezu mora pasti na vezi zacetka okna KONC"),
    ("SMER", "zgodba.js",
     "const SMER_PREHODA = { push: 1, panR: 1, pull: -1, panL: -1 };",
     "const SMER_PREHODA = { push: -1, panR: -1, pull: 1, panL: 1 };",
     "obrnjena smer prenosa mora pasti na SMER (clip-path in vodna črta oba "
     "kažeta nasprotno smer od pravila vrat)"),
    ("ZAMIK", "zgodba.js",
     "scale(${((1.02 + 0.10 * t) * pi).toFixed(4)}) translate(${(0.6 * t + dx)",
     "scale(${((1.02 + 0.10 * t) * pi).toFixed(4)}) translate(${(2.6 * t + dx)",
     "2,6-odstoten zasnovni zamik mora pasti na KONC"),
    ("LINEAR", "zgodba.js",
     "const UBLAG = 0.45;",
     "const UBLAG = 0.0;",
     "brez ublažitve mora pasti UTRIP (hoja je potem linearni drsnik)"),
    ("NICELNI", "zgodba.js",
     "    if (transform) v.gib.style.transform = transform;",
     "    if (transform) void transform;",
     "izpis ničesar mora pasti na DETERMINIZEM (in s tem KONC in UTRIP); ROB namerno "
     "ne more pasti — brez giba črnilo mirno prekrije okno, to je pravna posledica, ne vrzel"),
    ("PORIV", "zgodba.css",
     "background-image:linear-gradient(180deg,rgba(6,20,16,.52),rgba(2,8,5,.74)),var(--k-slika,none);",
     "background-image:linear-gradient(180deg,rgba(6,20,16,.52),rgba(2,8,5,.74)),var(--k-nic,none);",
     "izpraznjena podlaga pasu mora pasti na PORIV in ne na ROB "
     "(temno platno geometrijsko se vedno prekrije okno)"),
    ("PRESLIKAVA", "sonda",
     "      const a = [OX + m.a * (R.left - OX) + m.e, OX + m.a * (R.right - OX) + m.e];",
     "      const a = [OX + m.a * (R.left - OX), OX + m.a * (R.right - OX)];",
     "izpuscena translacija v lastni formuli mora pasti na PRESLIKAVA"),
]

if __name__ == "__main__":
    # Preden sploh kaj, pospravi posledice prejšnjega zaustavljenega zagona.
    # Brez tega koraka je verza umrla sredi LINEAR in je v rka-onepage pustila
    # aplicirano mutacijo; naslednji zagon je nato kot "osnovno" meril mutacijo
    # in je javil UTRIP namesto zelene podlage.
    for _dat in ("zgodba.js", "zgodba.css"):
        _pot = os.path.join(RKA_DIR, _dat)
        _bes = preberi(_pot)
        _izv = _bes
        for _ime, _cilj, _iz, _na, _ut in MUTACIJE:
            if _cilj == _dat and _bes.count(_na) == 1 and _bes.count(_iz) == 0:
                _bes = _bes.replace(_na, _iz)
                print("POVRNJENO " + _ime + ": prejšnji zagon je pustil mutacijo aplicirano")
        if _bes != _izv:
            zapisi(_pot, _bes)

    vrsta, oznake, koda, st = zazeni_sondo("osnovno")
    if vrsta != "cist":
        print("OSNOVNI ZAPIS ni cist: " + vrsta + " " + str(oznake) + " — najprej popravi vrata.")
        sys.exit(2)
    print("OSNOVNI ZAPIS: cist (izhod " + str(koda) + ", poskusov " + str(st) + ")")

    rezultati, spremeni = [], {}
    izbrani = [a.upper() for a in sys.argv[1:] if a.isalpha()]
    belezi("zagon izbrani=" + (",".join(izbrani) or "vsi"))
    for ime, cilj, iz, na, utemeljitev in MUTACIJE:
        if izbrani and ime not in izbrani:
            continue
        pot = zadeti(cilj)
        spremeni[ime] = (pot, spusti(pot), preberi(pot))
        pot, zeton, vsebina = spremeni[ime]
        if vsebina.count(iz) != 1:
            print("ZAPUSTLJENO " + ime + ": vez na vir ni ena edina (`" + prikaz(iz) + "`)")
            sys.exit(2)
        zapisi(pot, vsebina.replace(iz, na))
        belezi("aplicirano " + ime)
        vrsta, najdene, koda, st = zazeni_sondo(ime)
        zapisi(pot, vsebina)
        vrnil_se = spusti(pot) == zeton
        belezi("obnovljeno " + ime + " enako=" + str(vrnil_se) + " ocena=" + vrsta)

        if vrsta == "okolje" or vrsta == "smrt":
            ocena = "OKOLJE/SMRT: meritve ni bilo (" + "; ".join(najdene)[:60] + ")"
        elif vrsta == "cist":
            ocena = "MUTACIJA NI UJETA"
        elif not vrnil_se:
            ocena = "VRNIJEVE NE (datoteka ostala spremenjena)"
        else:
            pricakovano = [n for n in OCAKVANO[ime] if n in najdene]
            nepripravljene = [n for n in najdene if n not in OCAKVANO[ime]]
            if not pricakovano:
                ocena = "NAPACNA trditev: " + ",".join(najdene)
            elif nepripravljene:
                ocena = "STRANSKA: so pade tudi " + ",".join(nepripravljene)
            else:
                ocena = "UJETA (" + ",".join(najdene) + ")"
        print("  " + ime.ljust(12) + ocena.ljust(52) + " | " + utemeljitev)
        rezultati.append(ocena)

    vrsta, ostalo, koda, st = zazeni_sondo("zakljucek")
    print("\nSKUPAJ: " + str(sum(1 for x in rezultati if x.startswith("UJETA"))) + " ujetih, "
          + str(sum(1 for x in rezultati if x.startswith("NEZAJETO")))
          + " nezajetih (predvidene vrzeli), "
          + str(len(rezultati) - sum(1 for x in rezultati if x.startswith("UJETA"))
                - sum(1 for x in rezultati if x.startswith("NEZAJETO"))) + " tezav.")
    if vrsta != "cist":
        print("KONEC\nOSNOVNI ZAPIS po obnovitvi ni cist: " + vrsta + " " + str(ostalo)); sys.exit(1)
    tezave = [x for x in rezultati if not (x.startswith("UJETA") or x.startswith("NEZAJETO"))]
    print("KONEC")
    sys.exit(1 if tezave else 0)
