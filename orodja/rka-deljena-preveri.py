#!/usr/bin/env python3
"""Preveri delitveno sliko in strukturirane podatke strani River Kolpa.

Zasnovano tako, da vsak trditev v JSON-LD veže na dokaz v kodu strani: podatek,
ki ga ni mogoče najti v index.html ali app.js, je izmišljen in vrže napako.
"""
import json, re, sys, urllib.request
from pathlib import Path
from urllib.parse import urlparse

# Brez tega console napak prebere kot cp1250 in razsuti dolzine po celoti.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

STR = Path(r"C:\Users\admin\Downloads\sssdf\rka-onepage")
SPLET = "http://127.0.0.1:4183"

napake = []
def nap(ci):
    napake.append(ci)

html = (STR / "index.html").read_text(encoding="utf-8")
bloki_ld = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
# Dokazno gradivo NE sme vsebovati samega JSON-LD bloka, sicer si trditev potrdi
# sama — prav to je ujeti mutacijski preizkus.
html_brez_ld = re.sub(r'<script type="application/ld\+json">.*?</script>', "", html, flags=re.S)
korpus = html_brez_ld + (STR / "app.js").read_text(encoding="utf-8")
korpus_nl = korpus.lower()

def v(n, kaj):
    if kaj.lower() not in korpus_nl:
        nap(f"{n}: trditve ni v kodu strani -> {kaj!r}")


def rep_slike(url):
    """Lokalna pot slike, zavita v URL: vse od prvega '/assets/' naprej.

    Ni razredanja domene, zato deluje tudi pod potjo repozitorija
    (https://up.github.io/ime/assets/...), kjer './assets/...'.
    """
    i = url.find("/assets/")
    return url[i:] if i >= 0 else None


def osnovo(oznaka, koda, og, tw, slika_ld):
    """Preveri, ali je stran za objavo pripravljena ali pa je še lokalna.

    Dovoljeni sta dve SKLADNI stanji: z osnovo (absolutni URL-i, og:url in
    canonical) ali brez nje (koren-relativne poti, og:url in canonical izpustita).
    Mešano stanje je napaka: relativna slika se pod potjo repozitorija tiho ne
    postreže, izmišljena domena pa pade na 404 — obe napaki sta tihi, zato ju
    mora ujeti ta preizkus, ne brskalnik.
    """
    m = (re.search(r'<link[^>]+rel=["\']canonical["\'][^>]*href=["\']([^"\']+)["\']', koda)
         or re.search(r'<link[^>]+href=["\']([^"\']+)["\'][^>]*rel=["\']canonical["\']', koda))
    canonical = m.group(1) if m else None
    url = og.get("og:url")
    polja = [("og:image", og.get("og:image")), ("twitter:image", tw.get("twitter:image")),
             ("JSON-LD image", slika_ld)]
    polja = [(k, zr) for k, zr in polja if zr]
    absolutne = [k for k, zr in polja if zr.startswith(("http://", "https://"))]
    relativne = [k for k, zr in polja if not zr.startswith(("http://", "https://"))]

    if url or canonical or absolutne:
        stanje = "z osnovo"
        if not url:
            nap(f"{oznaka}: slika je absolutna, og:url pa manjka")
        if not canonical:
            nap(f"{oznaka}: slika je absolutna, canonical pa manjka")
        if url and canonical and url != canonical:
            nap(f"{oznaka}: og:url {url!r} in canonical {canonical!r} se razlikujeta")
        if relativne:
            nap(f"{oznaka}: mešano stanje — relativna pot pri {', '.join(relativne)}")
        for k, zr in polja:
            rep = rep_slike(zr)
            if not rep:
                nap(f"{oznaka}: {k} ne kaže na mapo assets/: {zr!r}")
            elif not (STR / rep.lstrip("/")).exists():
                nap(f"{oznaka}: {k} datoteka ne obstaja lokalno: {rep}")
    else:
        stanje = "brez osnove"
        for k, zr in polja:
            if not zr.startswith("/assets/"):
                nap(f"{oznaka}: {k} ne kaže na koren-relativno lokalno pot: {zr!r}")
            if not (STR / zr.lstrip("/")).exists():
                nap(f"{oznaka}: {k} datoteka ne obstaja: {zr}")
    return {"stanje": stanje, "og:url": url, "canonical": canonical,
            "slike": dict(polja)}

# --- glava: og + twitter -------------------------------------------------
og = dict(re.findall(r'<meta property="(og:[^"]+)" content="([^"]*)"', html))
tw = dict(re.findall(r'<meta name="(twitter:[^"]+)" content="([^"]*)"', html))

for k in ("og:type", "og:site_name", "og:locale", "og:title", "og:description",
          "og:image", "og:image:width", "og:image:height", "og:image:alt"):
    if k not in og:
        nap(f"manjka {k}")
if og.get("og:type") != "website":
    nap(f"og:type = {og.get('og:type')!r}")
if og.get("og:locale") != "sl_SI":
    nap(f"og:locale = {og.get('og:locale')!r}")
if tw.get("twitter:card") != "summary_large_image":
    nap(f"twitter:card = {tw.get('twitter:card')!r}")
for k in ("twitter:title", "twitter:description", "twitter:image", "twitter:image:alt"):
    if k not in tw:
        nap(f"manjka {k}")

# hreflang je prepovedan v obeh stanjih: jezikovni preklop je namenoma odstranjen,
# zato bi bila oznaka napaka v iskalniku, ne okras.
if re.search(r'hreflang', html):
    nap("hreflang je nastavljen, jezikovni preklop pa je namenoma odstranjen")

# --- datoteka slike ------------------------------------------------------
dat = STR / "assets" / "deljena-1200x630.jpg"
if dat.exists():
    out = __import__("subprocess").run(
        ["magick", "identify", "-format", "%w %h %m", str(dat)],
        capture_output=True, text=True).stdout.split()
    if out[:2] != ["1200", "630"]:
        nap(f"delitvena slika je {out[:2]}, ne 1200x630")
    if out[2] != "JPEG":
        nap(f"delitvena slika ni JPEG ({out[2]})")
    if og.get("og:image:width") != out[0] or og.get("og:image:height") != out[1]:
        nap("og:image:width/height ne ujemata se z dejansko datoteko")
    if dat.stat().st_size > 800_000:
        nap(f"delitvena slika je prevelika za objavo: {dat.stat().st_size} B")
else:
    nap("manjka assets/deljena-1200x630.jpg")

r = urllib.request.urlopen(f"{SPLET}/assets/deljena-1200x630.jpg", timeout=10)
if r.status != 200 or "jpeg" not in r.headers.get("Content-Type", ""):
    nap(f"slika se po HTTP ne postreže: {r.status} {r.headers.get('Content-Type')}")

# --- JSON-LD -------------------------------------------------------------
bloki = bloki_ld
if len(bloki) != 1:
    nap(f"pričakovan en JSON-LD blok, najdenih {len(bloki)}")
try:
    ld = json.loads(bloki[0]) if bloki else {}
except json.JSONDecodeError as e:
    nap(f"JSON-LD se ne razčleni: {e}")
    ld = {}

if ld.get("@context") != "https://schema.org":
    nap("JSON-LD @context ni schema.org")
if ld.get("@type") != "LodgingBusiness":
    nap(f"JSON-LD @type = {ld.get('@type')!r}")

osn_i = osnovo("index.html", html, og, tw, ld.get("image"))
pot_slike = osn_i["slike"].get("og:image", "")
if not pot_slike:
    nap("index.html: og:image je prazen")

# aggregateRating, geo in priceRange so namenoma izpuščeni: Google aggregateRating
# potrdi šele ob reviewItem-ih, geo in priceRange pa nimata vira, ki bi ga lahko
# pokazal. URL je edina izjema — obstaja takoj, ko obstaja javna osnova, in takrat
# mora biti enak canonicalu; sicer Google povezuje podjetje z napačnim naslovom.
for k in ("aggregateRating", "geo", "priceRange"):
    if k in ld:
        nap(f"{k} v JSON-LD brez vira — izpusti ga")
if osn_i["canonical"] and "url" not in ld:
    nap("je javna osnova, JSON-LD url pa manjka")
if "url" in ld and ld["url"] != osn_i["canonical"]:
    nap(f"JSON-LD url {ld['url']!r} ne ustreza canonical {osn_i['canonical']!r}")

# Polja, kjer sme biti vrednost v JSON-LD dobesedno enaka dokazu na strani.
DOBESEDNO = {
    "name": "River Kolpa Apartments",
    "legalName": "LOGIS APARTMENTS, Majda Pezdirc s.p.",
    "telephone": "+38640858732",
    "email": "majda.pezdirc@gmail.com",
}
for k, dokaz in DOBESEDNO.items():
    if k not in ld:
        nap(f"v JSON-LD manjka {k}")
        continue
    if str(ld[k]) != dokaz:
        nap(f"{k}: JSON-LD pravi {ld[k]!r}, stran pa {dokaz!r}")
    v(k, dokaz)

# Polja, kjer je dokaz stavek, vrednost pa iz njega izluščena oblika.
IZ_STAVKA = {
    "numberOfRooms": (4, "štiri samostojni apartmaji"),
    "checkinTime": ("15:00", "15.00 in 22.00"),
    "checkoutTime": ("10:00", "9.30 in 10.00"),
    "petsAllowed": (True, "Ljubljenčki ob predhodni najavi"),
    "smokingAllowed": (False, "Kajenje v prostorih je prepovedano"),
}
for k, (vrednost, dokaz) in IZ_STAVKA.items():
    if k not in ld:
        nap(f"v JSON-LD manjka {k}")
        continue
    if ld[k] != vrednost:
        nap(f"{k}: JSON-LD pravi {ld[k]!r}, stran pa {vrednost!r}")
    v(k, dokaz)

if ld.get("description") != re.search(r'<meta name="description" content="([^"]*)"', html).group(1):
    nap("JSON-LD description ne ustreza meta description")

for ident in ld.get("identifier", []):
    v("identifier", ident["value"])
for nas in ld.get("address", []):
    for pol in ("streetAddress", "addressLocality", "postalCode", "addressRegion", "addressCountry"):
        if not nas.get(pol):
            nap(f"naslov nima {pol}")
    v("address", nas["streetAddress"])
    v("address", nas["postalCode"])
if len(ld.get("address", [])) != 2:
    nap("pričakova dva naslova (Griblje 70 in Griblje 30 b)")
for ugod in ld.get("amenityFeature", []):
    if ugod.get("@type") != "LocationFeatureSpecification":
        nap(f"amenityFeature napačen @type: {ugod.get('@type')}")
    if ugod.get("value") is not True:
        nap(f"amenityFeature {ugod.get('name')} nima value=true")
    if ugod["name"].lower() not in korpus_nl:
        nap(f"amenityFeature {ugod['name']!r} ni virjen")
for sa in ld.get("sameAs", []):
    if sa not in korpus:
        nap(f"sameAs ni na strani: {sa}")
if ld.get("image") != og.get("og:image"):
    nap("JSON-LD image ne ustreza og:image")

# --- besedilo slike: ne sme imenovati hriba, ki ga nismo izmerili ---------
for prepovedani in ("Gorjanc", "Karavanke", "Alpe", "Kočevski Rog"):
    if prepovedani.lower() in (og.get("og:image:alt", "") + " " + ld.get("description", "")).lower():
        nap(f"alt/description omenjata {prepovedani}, tega nismo potrdili")

# --- zgodba.html: drugi og blok, ki ima ista pravila ----------------------
# Filmi se delijo pogosteje kot domača stran, zato njuni og-bloki ne smejo
# imeti različnih meril — sicer je šibkejši tisti, ki ga nihče ne čuva.
ZG_HTML = (STR / "zgodba.html").read_text(encoding="utf-8")
ZG_JS = (STR / "zgodba.js").read_text(encoding="utf-8")
og_z = dict(re.findall(r'<meta property="(og:[^"]+)" content="([^"]*)"', ZG_HTML))
tw_z = dict(re.findall(r'<meta name="(twitter:[^"]+)" content="([^"]*)"', ZG_HTML))

for k in ("og:type", "og:site_name", "og:locale", "og:title", "og:description",
          "og:image", "og:image:width", "og:image:height", "og:image:alt"):
    if k not in og_z:
        nap(f"zgodba.html: manjka {k}")
if og_z.get("og:type") != "website":
    nap(f"zgodba.html: og:type = {og_z.get('og:type')!r}")
if og_z.get("og:locale") != "sl_SI":
    nap(f"zgodba.html: og:locale = {og_z.get('og:locale')!r}")
if og_z.get("og:site_name") != og.get("og:site_name"):
    nap("zgodba.html: og:site_name se razlikuje od index.html")
if tw_z.get("twitter:card") != "summary_large_image":
    nap(f"zgodba.html: twitter:card = {tw_z.get('twitter:card')!r}")
if re.search(r'hreflang', ZG_HTML):
    nap("zgodba.html: hreflang je nastavljen, jezikovni preklop pa je namenoma odstranjen")
osn_z = osnovo("zgodba.html", ZG_HTML, og_z, tw_z, None)

# Obe strani morata biti v ISTEM stanju. Popolnoma posodobljena domača stran in
# stara filmska stran pomenita, da delitev filma na Facebooku ostane brez slike —
# in ravno film je tisti, ki ga ljudje delijo.
#
# Pravila tega bloka morajo biti ocenjena PREJ kot primerjava slike med stranema:
# različno stanje je vzrok, različna slika pa je samo njegov posledični izpis.
# Vrstni red odloča, katera napaka se pokaže prva — če bi bila prva primerjava, bi
# sporočilo o stanju ostalo mrtva koda in bi napotilo na napačno mesto.
if osn_i["stanje"] != osn_z["stanje"]:
    nap(f"index.html je {osn_i['stanje']}, zgodba.html pa {osn_z['stanje']} — "
        "obe strani se morata spremeniti hkrati (rka-postavi-osnovo.cjs)")
elif osn_i["canonical"]:
    koren = osn_i["canonical"].rstrip("/")
    cu = urlparse(osn_i["canonical"])
    if not cu.path.endswith("/"):
        nap(f"canonical index.html {osn_i['canonical']!r} ni koren strani — "
            "osnova je verjetno kopirana iz podstrani")
    if osn_z["canonical"] != koren + "/zgodba.html":
        nap(f"canonical zgodba.html {osn_z['canonical']!r} ne ustreza {koren}/zgodba.html")
    # Slika mora stati POD istim naslovom kot canonical, ne samo na isti domeni:
    # pod potjo repozitorija (…/rka-onepage/) je https://domena/assets/… od zunaj
    # videti pravilna, a vrže 404.
    for oznaka, r in (("index.html", osn_i), ("zgodba.html", osn_z)):
        for polje, zr in r["slike"].items():
            u = urlparse(zr)
            if (u.scheme, u.netloc) != (cu.scheme, cu.netloc) or \
               not u.path.startswith(cu.path.rstrip("/") + "/"):
                nap(f"{oznaka}: {polje} ne stoji pod canonical ({zr!r})")
                continue
            # Podvojena predpona poti je poseben, zelo pogost zlom: orodje, ki iz
            # starega naslova izreže samo domeno, napiše …/rka-onepage/rka-onepage/…
            rep = u.path[len(cu.path):]
            if cu.path != "/" and rep.startswith(cu.path.lstrip("/")):
                nap(f"{oznaka}: {polje} ima podvojeno pot repozitorija ({zr!r})")

if og_z.get("og:image") != pot_slike:
    nap(f"zgodba.html: og-image {og_z.get('og:image')!r} ni slika z glavne strani")
if dat.exists():
    if og_z.get("og:image:width") != out[0] or og_z.get("og:image:height") != out[1]:
        nap("zgodba.html: og:image:width/height ne ujemata se z dejansko datoteko")

OSNOVA = (osn_i["canonical"].rstrip("/")
          if osn_i["stanje"] == "z osnovo" and osn_i["canonical"] else None)
naslov_z = (og_z.get("og:title", "") + " " + og_z.get("og:description", "")).lower()

# Stevke v deljenem besedilu ne sme utemeljiti kar katera koli ista beseda na
# strani: "pet" nekje v tekstu ne dokazuje trditve "pet apartmajev". Par
# (števka, samostalnik) mora stati v viru v isti zvezi.
OBLIKE = {
    1: ("ena", "ene", "eni", "eno", "enih", "enim"),
    2: ("dva", "dve", "dveh", "dvema", "dema"),
    3: ("tri", "tri", "trih", "trimi"),
    4: ("štiri", "štirje", "štirih", "štirimi"),
    5: ("pet", "petih", "petim", "petimi"),
    6: ("šest", "šestih", "šestimi"),
    7: ("sedem", "sedmih", "sedmimi"),
    8: ("osem", "osmih", "osmimi"),
    9: ("devet", "devetih", "devetimi"),
    10: ("deset", "desetih", "desetimi"),
}
NAPETA = 25  # razdalja, znotraj katere števka še narekuje samostalnik
LOCILA = r"[,;:.!?()\s–—-]*"
STEVSKE_OBLIKE = {o for obi in OBLIKE.values() for o in obi}


def pari(besedilo):
    """(števka, koren) za vsako števko in vsako besedo za njo znotraj okna.
    Koren (prve tri črke) prestoji sklanjatvi: 'hiši' in 'hišah' sta ista trditev."""
    izs = set()
    for k, oblike in OBLIKE.items():
        for o in oblike:
            for m in re.finditer(r"(?<![a-zčšž])" + o + r"(?![a-zčšž])", besedilo):
                # Okno se konča na koncu povedi: sicer bi si souvisli besedi
                # izmišljale trditev druga drugi.
                za = re.split(r"[.!?]", besedilo[m.end():m.end() + NAPETA])[0]
                for n in re.finditer(r"(?<![a-zčšž])([a-zčšž]{3,})(?![a-zčšž])", za):
                    if n.group(1) in STEVSKE_OBLIKE:
                        continue
                    izs.add((k, n.group(1)[:3]))
    return izs


def citat(besedilo, par):
    """Človeško berljiv primerek, kaj gate išče — sicer je napaka uganka."""
    for o in OBLIKE[par[0]]:
        m = re.search(r"(?<![a-zčšž])" + o + LOCILA + r"[a-zčšž]*" + par[1] + r"[a-zčšž]*",
                      besedilo)
        if m:
            return m.group(0).strip()
    return f"{par[0]}×{par[1]}…"


# Korpus: kaj je dejansko zapisano na strani, v časovnem listu in v kodi
# predvajalnika. Meta oznaki sami sebi ne moreta biti dokaz.
korpus_z = (korpus + (STR / "spot.json").read_text(encoding="utf-8") + ZG_JS
            + re.sub(r"<meta[^>]*>", "", ZG_HTML)).lower()
vir_z = pari(korpus_z)

for stran, polja in (
        ("index.html", (("og:title", og.get("og:title", "")),
                        ("og:description", og.get("og:description", "")),
                        ("og:image:alt", og.get("og:image:alt", "")))),
        ("zgodba.html", (("og:title", og_z.get("og:title", "")),
                         ("og:description", og_z.get("og:description", "")),
                         ("og:image:alt", og_z.get("og:image:alt", ""))))):
    for polje, besedilo in polja:
        for par in sorted(pari(besedilo.lower())):
            if par not in vir_z:
                nap(f"{stran} {polje}: trditev '{citat(besedilo.lower(), par)}' nima vira — "
                    f"števka {par[0]} ob korenu '{par[1]}' se v virih ne pojavi")

# "časovni list" v opisu je obljuba, da stran predvaja isti seznam kadrov kot
# izvoženi MP4. Dokaz je dejanski fetch te datoteke, ne niz, ki se pojavi tudi
# v komentarjih — drugače si obljubo potrdi komentar.
if "časovni list" in naslov_z and not re.search(
        r"""fetch\(\s*["'][^"']*spot\.json["']""", ZG_JS):
    nap("zgodba.html: obljublja isti časovni list, zgodba.js pa ga ne bere s fetchom")

for prepovedani in ("Gorjanc", "Karavanke", "Alpe", "Kočevski Rog"):
    if prepovedani.lower() in (og_z.get("og:image:alt", "")
                               + " " + og_z.get("og:description", "")).lower():
        nap(f"zgodba.html: alt/description omenjata {prepovedani}, tega nismo potrdili")

print(f"preverjenih polj: og={len(og)} twitter={len(tw)} json-ld={len(ld)} "
      f"| zgodba og={len(og_z)} twitter={len(tw_z)}")
if OSNOVA:
    print(f"OSNOVA {OSNOVA} — slika, og:url, canonical in JSON-LD url so absolutni")
else:
    print("NI OSNOVE — strani ostaneta neobjavljivi. Pred objavo zaženi: "
          "node rka-postavi-osnovo.cjs --base=https://NASLOV --zapisi")
if napake:
    print("NESKLADJE:")
    for n in napake:
        print("  -", n)
    sys.exit(1)
print("V REDU: delitvena slika in strukturirani podatki sta skladni z viri na strani.")
