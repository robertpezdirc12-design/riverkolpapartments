#!/usr/bin/env python3
"""Preveri jezik neizgovorjenih napisov v angleškem rezu.

Pripoved je varovana drugod: namera meri zvok, podnapisi berejo iz nje. Tukaj so
napisi, ki jih zvok nikoli ne izgovori, zato jih nobena meritev ne more razkriti:
naslovec (eb), podnaslov (pod) in oznake (znacke). Zanje spot.json pozna
razlicico z nastavko "En".

Vrata ne primerjajo besedila z besedilom, ampak izvir besedila. Stavek je lahko
anglezki samo, ce je vzet iz polja, ki ga je nekdo napisal kot anglezkega
(govorEn, govorEn60, ebEn, podEn, znackeEn). Ce je vzet iz slovenskega
izvirnika, sme ostati samo kraj, naslov in blagovno ime — vse ostalo pade.

Kot dokaz, da je anglezko polje res anglezko, služi slovenski besednjak,
izpeljan iz slovenskih polj celotnega spota, in stevec pojavitev v angleških
poljih. Beseda, ki se v angleških poljih pojavi samo v preverjanem stavku,
drugod pa le v slovenskem izvirniku, je neprevedena. Izjema so dvjezične
besede ("studio", "pergola"), ki se v obeh jezikih glasi enako.

Omejitev, ki jo mora vsak vedeti: pravila ne ujamejo slovenske besede, ki je
ni v slovenskem besednjaku spota, nima dijakritike in je v angleških poljih
enkratna. Zato mutacijski test, ne zaupanje.

Drugi del pregleda je strukturen: zgodba.js teh polj ne sme brati golo, sicer
bi se merjeni seznam razsel od dejanskega izpisa.
"""
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json
import re
import sys
from pathlib import Path

STR = Path(r"C:\Users\admin\Downloads\sssdf\rka-onepage")
SPOT = STR / "spot.json"
IZV = STR / "zgodba.js"

# Celotni stavki, ki se ne prevajajo: blagovno ime in nasova.
NEVTRALNO_STAVKI = {
    "River Kolpa Apartments",
    "Griblje · Bela krajina",
    "Griblje 70 · Griblje 30 b · Bela krajina",
    "SI-8332 Gradac",
}
# Posamicne besede, ki smejo ostati v obeh jezikih.
NEVTRALNO_BESEDE = {"griblje", "bela", "krajina", "river", "kolpa", "apartments",
                    "si", "gradac", "majda", "pezdirc", "booking", "com", "gmail",
                    "b"}
# Besede, ki se v obeh jezikih glasi enako: same sebi ne morejo biti dokaz,
# da so slovenske, ker prevod zanje ne obstaja.
DWJEZIKOVNO = {"studio", "pergola", "jacuzzi"}
# Slovenske sklonitve in predlogi, ki jih v spotu morda ni, a v angleškem
# stavku nedvomno spadajo. Dvjezični "in", "na", "v", "do", "his", "sam" tu
# namenoma ne smejo biti — angleška beseda bi se sama obtožila.
SLOVENSKO_DODATNO = {"je", "so", "ki", "ter", "od", "pri", "pred", "med", "brez",
                     "se", "mu", "ji", "še", "dve", "ena", "svojo", "vsaka",
                     "njun", "njej", "hisa", "reka", "reki", "vrt", "terasa",
                     "zasebnost", "provizije", "mnenj"}
JEZIKI = ("sl", "en")
NAPISI = ("eb", "pod", "znacke")


def besede(stavek):
    return re.findall(r"[a-zčšžć]+", stavek.lower())


def nevtralen(stavek):
    return stavek in NEVTRALNO_STAVKI or (besede(stavek) and
                                          all(w in NEVTRALNO_BESEDE for w in besede(stavek)))


def kot_anglesko(polje):
    """Polje je angleško, če se imenuje ...En ali ...En<rez>. Ime odloča, ne vsebina."""
    return bool(re.fullmatch(r"[a-z]+En\d*", polje))


def nizovi(vrednost):
    return vrednost if isinstance(vrednost, list) else [vrednost]


def vokabular(spot):
    """Slovenski besednjak spota in stevec pojavitev vsake besede v anglekih
    poljih. Stevec je nujen: brez njega bi bila beseda, ki jo nekdo prepisno
    vrine v angleko polje, sama sebi alibi."""
    slovenske, angleke = set(), {}

    def doloci(polje):
        return "en" if kot_anglesko(polje) else "sl"

    for k in spot["kadri"]:
        for polje, vrednost in k.items():
            if not isinstance(vrednost, (str, list)):
                continue
            for stavek in nizovi(vrednost):
                if not isinstance(stavek, str):
                    continue
                if doloci(polje) == "en":
                    for b in set(besede(stavek)):
                        angleke[b] = angleke.get(b, 0) + 1
                elif polje in NAPISI or polje == "beso" or polje.startswith("govorSl"):
                    slovenske.update(besede(stavek))
    for _, rez in spot["rezi"].items():
        for polje, vrednost in rez.items():
            if not isinstance(vrednost, dict):
                continue
            for stavek in vrednost.values():
                if not isinstance(stavek, str):
                    continue
                if doloci(polje) == "en":
                    for b in set(besede(stavek)):
                        angleke[b] = angleke.get(b, 0) + 1
                else:
                    slovenske.update(besede(stavek))
    return slovenske | SLOVENSKO_DODATNO, angleke


def poved(enota, rez, kader, jezik):
    """Isti izbor kot napisKadra: najprej razlicica enote, nato kadra, nato beso."""
    kratica = "Sl" if jezik == "sl" else "En"
    poenotenih = rez.get("govor" + kratica + enota) or {}
    if kader["id"] in poenotenih:
        return poenotenih[kader["id"]], "govor" + kratica + enota
    if "govor" + kratica in kader:
        return kader["govor" + kratica], "govor" + kratica
    return kader.get("beso"), "beso"


def napis(enota, kader, polje, jezik):
    """Isti izbor kot pod() in jezikovno() v zgodba.js."""
    if polje == "pod" and kader.get("podRez") and kader["podRez"] != enota:
        return None, None
    if jezik == "en" and kader.get(polje + "En") is not None:
        return kader[polje + "En"], polje + "En"
    return kader.get(polje), polje


def angleki_slovenscina(stavek, slovenske, angleki):
    """Besede, ki v anglekem polju ne smejo stati. Diakritika je nedvomna;
    beseda iz slovenskega besednjaka pa samo, ce nima alibija drugje v
    anglekih poljih."""
    krive = []
    for b in set(besede(stavek)):
        if b in NEVTRALNO_BESEDE or b in DWJEZIKOVNO:
            continue
        if re.search(r"[čšžć]", b):
            krive.append(b + " (slovenski znaki)")
        elif b in slovenske and angleki.get(b, 0) < 2:
            krive.append(b + " (samo v slovenskih poljih)")
    return sorted(krive)


def pregled(spot):
    napake = []
    slovenske, angleki = vokabular(spot)
    for enota, rez in spot["rezi"].items():
        kadri = {k["id"]: k for k in spot["kadri"]}
        for id, _ in rez["niz"]:
            k = kadri[id]
            for jezik in JEZIKI:
                vrstica, _ = poved(enota, rez, k, jezik)
                if vrstica is None:
                    napake.append(f":{enota} {id} — {jezik} nima povedene vrstice")
            # Angleki rez ne sme pasti na slovenski beso: napis in glas se razideta
            vrstica, izvor = poved(enota, rez, k, "en")
            if vrstica and izvor == "beso" and not nevtralen(vrstica):
                napake.append(f":{enota} {id} — angleški rez pade na slovenski beso: "
                              f"{vrstica!r}")
            if vrstica and izvor != "beso":
                krive = angleki_slovenscina(vrstica, slovenske, angleki)
                if krive:
                    napake.append(f":{enota} {id}.{izvor} ni anglek ({', '.join(krive)}): "
                                  f"{vrstica!r}")
            for polje in NAPISI:
                vrednost, izvor = napis(enota, k, polje, "en")
                if vrednost is None:
                    continue
                for stavek in nizovi(vrednost):
                    if not isinstance(stavek, str):
                        continue
                    if izvor.endswith("En"):
                        krive = angleki_slovenscina(stavek, slovenske, angleki)
                        if krive:
                            napake.append(
                                f":{enota} {id}.{izvor} ni anglek ({', '.join(krive)}): "
                                f"{stavek!r}")
                        continue
                    if nevtralen(stavek):
                        continue
                    tuje = [w for w in besede(stavek) if w not in NEVTRALNO_BESEDE]
                    napake.append(f":{enota} {id}.{polje} — angleški rez izpisuje "
                                  f"slovensko ({', '.join(tuje)}): {stavek!r}")
            # podnaslov dopolni kratko poved; kjer je poved dolga, se ne ponovi
            for jezik in JEZIKI:
                p, _izvor = napis(enota, k, "pod", jezik)
                vrstica, _i2 = poved(enota, rez, k, jezik)
                if p and vrstica and p.lower() in vrstica.lower():
                    napake.append(f":{enota} {id}.pod — {p!r} je že v povedi {vrstica!r}")
    for k in spot["kadri"]:
        for polje in NAPISI:
            if polje + "En" in k and polje not in k:
                napake.append(f"{k['id']}: {polje}En brez izvirnika {polje}")
            if polje + "En" in k and isinstance(k.get(polje), list) \
                    and len(k[polje]) != len(k[polje + "En"]):
                napake.append(f"{k['id']}: {polje}En nima enako dolgih oznak kot {polje}")
        if "podRez" in k and "pod" not in k:
            napake.append(f"{k['id']}: podRez brez podnaslova")
        for polje in k:
            if polje.endswith("En") and not kot_anglesko(polje) and polje not in NAPISI:
                napake.append(f"{k['id']}: polje {polje} predvajalnik ne pozna")
    # mrtva razlicica: polje "En", ki ga nobena enota ne priklice
    uporabljeni = set()
    for enota, rez in spot["rezi"].items():
        kadri = {k["id"]: k for k in spot["kadri"]}
        for id, _ in rez["niz"]:
            for polje in NAPISI:
                vrednost, izvor = napis(enota, kadri[id], polje, "en")
                if vrednost is not None and izvor.endswith("En"):
                    uporabljeni.add((id, izvor))
    for k in spot["kadri"]:
        for polje in NAPISI:
            if polje + "En" in k and (k["id"], polje + "En") not in uporabljeni:
                napake.append(f"{k['id']}: {polje}En se v nobeni enoti ne izpiše")
    return napake


def struktura(spot):
    besedilo = IZV.read_text(encoding="utf-8")
    napake = []
    for polje in NAPISI:
        for m in re.finditer(r"\b(?:k|kader)\." + polje + r"\b", besedilo):
            napake.append(f"zgodba.js:{besedilo[:m.start()].count(chr(10)) + 1} — "
                          f"golo branje {polje}, namesto jezikovno() oziroma pod()")
    if any("podRez" in n for n in spot["kadri"]) and "kader.podRez" not in besedilo:
        napake.append("spot.json pozna podRez, zgodba.js ga ne bere (kader.podRez)")
    return napake


spot = json.loads(SPOT.read_text(encoding="utf-8"))
napake = pregled(spot) + struktura(spot)
slovenske, angleki = vokabular(spot)
print(f"pregledanih enot: {len(spot['rezi'])}, kadrov: {len(spot['kadri'])}, "
      f"slovenski besednjak: {len(slovenske)} besed, angleških nizov: {len(angleki)}")
for n in napake:
    print(" -", n)
print("jezik: " + ("V REDU" if not napake else f"{len(napake)} NAPAK"))
sys.exit(1 if napake else 0)
