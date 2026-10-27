#!/usr/bin/env python3
"""Mutacijski preizkus gate-a rka-deljena-preveri.py v OBAH stanjih.

Vrata imajo dve dovoljeni stanji: brez javne osnove (lokalne poti) in z osnovo
(absolutni URL-ji, og:url, canonical). Pravila o mešanem stanju se lahko pokaže
šele v stanju, kjer lahko nastane — zato vsako stanje najprej postavimo z
rka-postavi-osnovo.cjs, gate preverimo na čistem, nato pa mutiramo.

Če katera mutacija gre skozi, kontrola ne verjame temu, kar trdi.
"""
import shutil, subprocess, sys
from pathlib import Path

# Slednji zadetek je bil izpis po cp1250 in je strmoglavil na nadomestnem
# znaku, ne na napaki gate-a: izhod orodja vedno kodiraj v UTF-8.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DOM = Path(r"C:\Users\admin\Downloads\sssdf\rka-onepage")
HTML = DOM / "index.html"
ZGODBA = DOM / "zgodba.html"
ZGODBA_JS = DOM / "zgodba.js"
GATE = Path(r"C:\Users\admin\AppData\Local\Temp\rka-deljena-preveri.py")
POSTAVI = Path(r"C:\Users\admin\AppData\Local\Temp\rka-postavi-osnovo.cjs")
BAZA = "https://test.si/rka-onepage"      # navidezni javni naslov faze Z

# --- mutacije, ki veljajo v obeh stanjih (sidra so stanju nevtralna) --------
SKUPNE = [
    (HTML, "napačna širina slike",        '<meta property="og:image:width" content="1200">',
                                          '<meta property="og:image:width" content="1201">'),
    (HTML, "izmišljen aggregateRating",   '"numberOfRooms": 4,',
                                          '"numberOfRooms": 4, "aggregateRating": {"@type":"AggregateRating","ratingValue":"10","reviewCount":"8"},'),
    (HTML, "prepisana telefonska številka", '"telephone": "+38640858732"',
                                          '"telephone": "+38640858733"'),
    (HTML, "izgubljen twitter:card",      '<meta name="twitter:card" content="summary_large_image">',
                                          ''),
    # Rep slike, ne cela vrednost: mutacija velja tako za /assets/… kot za
    # https://test.si/rka-onepage/assets/….
    (HTML, "slika ne obstaja",            'deljena-1200x630.jpg', 'deljena-9999x9999.jpg', True),
    (HTML, "izmišljen hrib v alt",        'v ozadju bregovi Bele krajine.',
                                          'v ozadju Gorjanci.'),
    (HTML, "nestroken JSON-LD",           '"@context": "https://schema.org",',
                                          '"@context": "https://schema.org" "x":1,'),
    (HTML, "izmišljena ugodnost",         '{ "@type": "LocationFeatureSpecification", "name": "Jacuzzi", "value": true }',
                                          '{ "@type": "LocationFeatureSpecification", "name": "Zasebni bazen", "value": true }'),
    (HTML, "napačen čas odjave",          '"checkoutTime": "10:00"',
                                          '"checkoutTime": "11:00"'),
    (HTML, "izmišljen naslov",            '"streetAddress": "Griblje 30 b"',
                                          '"streetAddress": "Griblje 12"'),
    (ZGODBA, "zgodba: manjka og:image:width",
                                          '<meta property="og:image:width" content="1200">\n', ''),
    (ZGODBA, "zgodba: napačna širina",    '<meta property="og:image:width" content="1200">',
                                          '<meta property="og:image:width" content="800">'),
    (ZGODBA, "zgodba: drugi site_name",   '<meta property="og:site_name" content="River Kolpa Apartments">',
                                          '<meta property="og:site_name" content="Kolpa Story">'),
    (ZGODBA, "zgodba: tuja slika",        'assets/deljena-1200x630.jpg', 'assets/poster.webp'),
    (ZGODBA, "zgodba: izmišljeno število apartmajev",
                                          'content="Reklama ob Kolpi — dve hiši, štirje apartmaji"',
                                          'content="Reklama ob Kolpi — dve hiši, pet apartmajev"'),
    (ZGODBA, "zgodba: izmišljeno število hiš",
                                          'content="Reklama ob Kolpi — dve hiši, štirje apartmaji"',
                                          'content="Reklama ob Kolpi — osem hiš, štirje apartmaji"'),
    (ZGODBA_JS, "zgodba: opis obljublja časovni list, predvajalnik pa ga ne bere",
                                          '"spot.json"', '"casovni-list.json"', True),
    (ZGODBA, "zgodba: izgubljen twitter:card",
                                          '<meta name="twitter:card" content="summary_large_image">\n', ''),
    (ZGODBA, "zgodba: izmišljen hrib v alt",
                                          '<meta property="og:image:alt" content="Travnik z lesenimi ležalniki pred hišo v Gribljah, v ozadju bregovi Bele krajine.">',
                                          '<meta property="og:image:alt" content="Travnik pred hišo, v ozadju Karavanke.">'),
]

# --- samo stanje BREZ osnove: tu je vsak absolutni naslov mešanje -----------
BREZ = [
    (HTML, "vstavljen canonical sicer, a brez absolutnih slik",
                                          '<meta property="og:type" content="website">',
                                          '<link rel="canonical" href="https://riverkolpa.si/">\n<meta property="og:type" content="website">'),
    (ZGODBA, "zgodba: vstavljen canonical brez absolutnih slik",
                                          '<meta property="og:type" content="website">',
                                          '<link rel="canonical" href="https://riverkolpa.si/zgodba.html">\n<meta property="og:type" content="website">'),
    (HTML, "samo og:image absolutna, ostalo lokalno",
                                          '<meta property="og:image" content="/assets/deljena-1200x630.jpg">',
                                          '<meta property="og:image" content="https://riverkolpa.si/assets/deljena-1200x630.jpg">'),
]

# --- samo stanje Z osnovo: tu se lahko rodijo neskladja med naslovi ---------
Z = [
    # Osnova, kopirana iz naslovne vrste podstrani: vsi trije naslovi so med seboj
    # SKLADNI, zato jih nobena primerjava med njimi ne ujame — ujeti mora pravilo,
    # ki hoče, da je canonical index.html koren strani. Zato mutacija spremeni
    # canonical, og:url in JSON-LD url hkrati.
    (HTML, "osnova kopirana z naslovne vrste podstrani", [
        ('<link rel="canonical" href="https://test.si/rka-onepage/">',
         '<link rel="canonical" href="https://test.si/rka-onepage/zgodba.html">'),
        ('<meta property="og:url" content="https://test.si/rka-onepage/">',
         '<meta property="og:url" content="https://test.si/rka-onepage/zgodba.html">'),
        ('"url": "https://test.si/rka-onepage/",',
         '"url": "https://test.si/rka-onepage/zgodba.html",'),
    ]),
    # Enako za pričakovano POT podstrani: canonical in og:url se med seboj ujemata,
    # a ne ustrezata indexovu korenu.
    (ZGODBA, "zgodba: canonical in og:url na napačni poti", [
        ('<meta property="og:url" content="https://test.si/rka-onepage/zgodba.html">',
         '<meta property="og:url" content="https://test.si/rka-onepage/zgodba/index.html">'),
        ('<link rel="canonical" href="https://test.si/rka-onepage/zgodba.html">',
         '<link rel="canonical" href="https://test.si/rka-onepage/zgodba/index.html">'),
    ]),
    (HTML, "og:url ne ustreza canonicalu",
                                          '<meta property="og:url" content="https://test.si/rka-onepage/">',
                                          '<meta property="og:url" content="https://test.si/rka-onepage/index.html">'),
    (HTML, "JSON-LD url brez končne poševnice",
                                          '"url": "https://test.si/rka-onepage/",',
                                          '"url": "https://test.si/rka-onepage",'),
    # Obe strani naenkrat: sicer ujame primerjava med datotekama, ne pravilo o
    # spekulanovem spletu. Pravilo hočemo videti delovati samo.
    ([HTML, ZGODBA], "slika na tujem spletu (obe strani)",
                                          'https://test.si/rka-onepage/assets/deljena-1200x630.jpg',
                                          'https://drugi.si/assets/deljena-1200x630.jpg', True),
    # Podvojena pot — ravno ta napaka nastane, če orodje iz obstoječega naslova
    # izreže domeno namesto skupne predpone poti.
    ([HTML, ZGODBA], "slika s podvojeno potjo repozitorija",
                                          'https://test.si/rka-onepage/assets/deljena-1200x630.jpg',
                                          'https://test.si/rka-onepage/rka-onepage/assets/deljena-1200x630.jpg', True),
    (ZGODBA, "zgodba: izgubljen canonical",
                                          '<link rel="canonical" href="https://test.si/rka-onepage/zgodba.html">\n', ''),
    # Ena stran posodobljena, druga ne — najbolj verjetna prava napaka, ker se
    # posodobi le index.html.
    (ZGODBA, "zgodba ostane brez osnove", [
        ('content="https://test.si/rka-onepage/assets/deljena-1200x630.jpg"',
         'content="/assets/deljena-1200x630.jpg"'),
        ('<meta property="og:url" content="https://test.si/rka-onepage/zgodba.html">\n', ''),
        ('<link rel="canonical" href="https://test.si/rka-onepage/zgodba.html">\n', ''),
    ]),
]


def telo_mutacije(telo):
    """Normalizira zapis mutacije na seznam parov in zastavico 'vse'.

    Dovoljeni zapisa:
      (staro, novo)              ena izmena, prva pojavitev
      (staro, novo, True)        ena izmena, vse pojavitve
      [(staro, novo), ...]       več izmen, ki skupaj tvorijo en sam pokvarjen
                                 pogoj (npr. 'stran ostane brez osnove')
    """
    if isinstance(telo[0], list):
        return [(s, n) for s, n in telo[0]], False
    return [(telo[0], telo[1])], bool(len(telo) > 2 and telo[2])


def izvedi(poti, telo):
    """(vsebina po datotekah, opis) ali (None, razlog zakaj mutacija ni dokaz).

    Mutacija je lahko večdatotečna: napaka, ki jo hočemo dokazati, je včasih šele
    RAZLIKA med datotekama (npr. slika na tujem spletu na obeh straneh), in takrat
    mora mutacija spremeniti obe, sicer gate ujame drugo pravilo, ne tisto, ki ga
    hočemo videti delovati.
    """
    par, vse = telo_mutacije(telo)
    spremenjeno = {}
    for pot in poti:
        bes = pot.read_bytes()
        izvir = bes
        for s, n in par:
            sb, nb = s.encode("utf-8"), n.encode("utf-8")
            if sb not in bes:
                return None, f"izvirnika ni v {pot.name}: {s[:40]!r} — mutacija ni izvedena"
            if sb == nb:
                return None, "mutacija ne spremeni ničesar — ni dokaza"
            bes = bes.replace(sb, nb) if vse else bes.replace(sb, nb, 1)
        if bes == izvir:
            return None, f"{pot.name} po mutaciji je identična — ni dokaza"
        spremenjeno[pot] = bes
    return spremenjeno, ""


def zagon(args):
    return subprocess.run(args, capture_output=True, text=True,
                          encoding="utf-8", errors="replace")


def dokazi(oznaka, mutacije, pripravi):
    print(f"\n=== stanje: {oznaka} ===")
    normalizirani = {}
    try:
        r = pripravi()
        if r.returncode != 0:
            print(f"  SMRT pri pripravi stanja:\n{r.stdout}{r.stderr}")
            return -1
        r = zagon([sys.executable, str(GATE)])
        if r.returncode != 0:
            print("  SMRT: v čistem stanju " + oznaka + " vrata NE vzpostavijo skladnosti —\n"
                  "  dokazovati napake v stanju, ki že samo pade, ni dokaz:\n"
                  + "\n".join("    " + l for l in r.stdout.splitlines() if l.strip().startswith("-")))
            return -1
        for vrstica in r.stdout.splitlines():
            if "OSNOVA" in vrstica:
                print("  " + vrstica.strip())
        for p in (HTML, ZGODBA, ZGODBA_JS):
            normalizirani[p] = p.read_bytes()
        slabo = 0
        for mut in mutacije:
            pot, ime = mut[0], mut[1]
            poti = pot if isinstance(pot, list) else [pot]
            telo = mut[2:]
            nova, razlog = izvedi(poti, telo)
            if nova is None:
                print(f"  ? {ime}: {razlog}")
                slabo += 1
                continue
            for p, vsebina in nova.items():
                p.write_bytes(vsebina)
            r = zagon([sys.executable, str(GATE)])
            ujet = r.returncode != 0
            zadetek = next((l.strip()[1:].strip() for l in r.stdout.splitlines()
                            if l.strip().startswith("-")), "")
            print(f"  {'UJETA' if ujet else 'SPODKLIPLA'}  {ime}   {zadetek}")
            if not ujet:
                slabo += 1
            for p in poti:
                p.write_bytes(normalizirani[p])
        return len(mutacije) - slabo
    finally:
        # Vrne stanje, ki ga je harness postavil; prvotne byte ponastavi šele
        # klic na vrhu, ko obe fazi končata — sicer bi druga faza začela v
        # prvi. Tukaj je pomembno le: nobena mutacija ne sme preživeti faze.
        for p, vsebina in normalizirani.items():
            p.write_bytes(vsebina)


izviri = {p: p.read_bytes() for p in (HTML, ZGODBA, ZGODBA_JS)}
uporabi_brez = lambda: zagon(["node", str(POSTAVI), "--odstrani", "--zapisi"])
uporabi_z = lambda: zagon(["node", str(POSTAVI), f"--base={BAZA}", "--zapisi"])

rezultati = {}
try:
    rezultati["brez"] = (dokazi("brez osnove", SKUPNE + BREZ, uporabi_brez), len(SKUPNE + BREZ))
    rezultati["z osnovo"] = (dokazi("z osnovo", SKUPNE + Z, uporabi_z), len(SKUPNE + Z))
finally:
    for p, izv in izviri.items():
        p.write_bytes(izv)

r = zagon([sys.executable, str(GATE)])
print(f"\n  {'V REDU' if r.returncode == 0 else 'NAPAKA'}  obnovljen prvotni izvir")
slabo = r.returncode != 0
for stanje, (ujeto, vseh) in rezultati.items():
    print(f"  {ujeto}/{vseh} mutacij ujetih — stanje {stanje}")
    # -1 pomeni, da faza sploh ni začela dokazovati (priprava stanja ali čisto
    # stanje je padlo). Šteti jo kot uspeh je ravno tisto, česar ta harness ne
    # sme dovoliti.
    if ujeto != vseh:
        slabo = True
sys.exit(1 if slabo else 0)
