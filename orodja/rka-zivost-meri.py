#!/usr/bin/env python3
# Živost spota: meri reklamo po istih osieh, po katerih jo sodijo referenčni
# postopki (reži, gib, prehodi, zvočni sloji, obnašanje besedila, živa vsebina).
#
# Ni vrata, ampak skala: izpiše številke, ki jih lahko ponovi. Vrata, ki preverjajo
# posamezno trditev, so v rka-zivost-preveri.py.
#
#   raba: python rka-zivost-meri.py [60|30]
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json, os, statistics, sys

SPLAT = r"C:\Users\admin\Downloads\sssdf\rka-onepage"
SEZNAM = os.path.join(SPLAT, "spot.json")
JS = os.path.join(SPLAT, "zgodba.js")
ZVOK = os.path.join(SPLAT, "zvok")


def nalozji():
    with open(SEZNAM, encoding="utf-8") as f:
        return json.load(f)


def rez(rez_id):
    m = nalozji()
    r = m["rezi"][rez_id]
    enota = r["dolzina"]
    bit = r.get("bit") or {}
    bpm = bit.get("bpm", 0.0)
    utrip = 60.0 / bpm if bpm else None
    okna = [w for _, w in r["niz"]]
    b = [bit["utripovi"].get(k) for k, _ in r["niz"]] if bit.get("utripovi") else None
    return m, r, enota, utrip, okna, b


def tabela(naslov, vrstice):
    print(f"\n{naslov}")
    for a, b in vrstice:
        print(f"  {a:<34} {b}")


def main():
    rez_id = next((a for a in sys.argv[1:] if a in ("60", "30")), "60")
    m, r, enota, utrip, okna, bitske = rez(rez_id)
    kadri = {k["id"]: k for k in m["kadri"]}
    zacetki, t = [], 0.0
    for kid, w in r["niz"]:
        zacetki.append(round(t, 5))
        t += w
    pari = list(zip([k for k, _ in r["niz"]], okna, zacetki))

    print(f"REZ :{rez_id}  {enota} s  {len(okna)} kadrov  {len(okna)-1} reznih tock"
          + (f"  mreza {r['bit']['bpm']:g} BPM / utrip {utrip*1000:.1f} ms"
             if utrip else "  BREZ MREZE"))

    pol = len(okna) // 2
    rows = [
        ("trajanje kadra min / max / povpr.",
         f"{min(okna):g} / {max(okna):g} / {statistics.fmean(okna):.2f} s"),
        ("razprsenost (std)", f"{statistics.stdev(okna):.3f} s"),
        ("prva polovica / druga polovica",
         f"{statistics.fmean(okna[:pol]):.2f} s / {statistics.fmean(okna[pol:]):.2f} s"),
    ]
    if bitske and all(bitske):
        rows.append(("kadri v utripih",
                     f"{min(bitske)} / {max(bitske)} / povpr. {statistics.fmean(bitske):.1f}"))
        nizi, cur = [], 1
        for i in range(1, len(bitske)):
            if bitske[i] == bitske[i - 1]:
                cur += 1
            else:
                nizi.append(cur); cur = 1
        nizi.append(cur)
        rows.append(("najdaljsi niz enakih dolzin", f"{max(nizi)} zaporednih kadrov"))
    rows.append(("rezi na sekundo", f"{(len(okna)-1)/enota:.2f}"))
    tabela("1. REZI", rows)

    # 2. GIB: hitrost in oblika gibanja, kot jo dejansko racuna zgodba.js
    with open(JS, encoding="utf-8") as f:
        js = f.read()
    hitrosti = []
    for kid, w, _ in pari:
        k = kadri[kid]
        gib = k.get("gib", "ni")
        if k["vrsta"] != "slika" or gib == "ni":
            continue
        if gib in ("push", "pull"):
            hitrosti.append(10.0 / w)          # scale se spremeni za 0.10 = 10 %
        else:
            hitrosti.append(6.8 / w)           # translateX potuje 6,8 % sirine
    linearna = "t je linearen" if "1.02 + 0.10 * t" in js else "ni najdeno"
    gibs = {}
    for kid, w, _ in pari:
        g = kadri[kid].get("gib", "ni")
        gibs[g] = gibs.get(g, 0) + 1
    tabela("2. GIB KAMERE", [
        ("vrsti giba", ", ".join(f"{k}:{v}" for k, v in sorted(gibs.items()))),
        ("pot/okno (push,pull: %/s; pan: %sirine/s)",
         f"{min(hitrosti):.2f} / {max(hitrosti):.2f} / povpr. "
         f"{statistics.fmean(hitrosti):.2f}"),
        ("krivulja hitrosti", linearna),
        ("tresenje / roka operaterja",
         "DA" if "tresenje" in js or "jitter" in js else "NI"),
        ("skokov znotraj kadra (punch-in)",
         str(js.count("punch")) if "punch" in js else "NI"),
    ])

    # 3. PREHOD
    wipe = "inset(0 ${(1 - napred) * 100}% 0 0)" in js
    tabela("3. PREHODI", [
        ("smer zabrisa", "zlaga-levo (inset ... 0 0) samo ena smer"
         if wipe else "ni najdeno"),
        ("razlicnih smeri", "1" if wipe else "0"),
        ("traject resov", f"{js.count('clipPath')}x clipPath v izris()"),
    ])

    # 4. ZVOK: koliko slojev dejansko tece pod govorom
    seznam_viri = os.path.join(ZVOK, f"namera-{rez_id}-sl.json")
    pripoved = None
    if os.path.exists(seznam_viri):
        with open(seznam_viri, encoding="utf-8") as f:
            pripoved = json.load(f).get("pripoved_skupaj")
    zrak = (enota - pripoved) if pripoved else None
    tabela("4. ZVOK", [
        ("sloji miksa (rka-zvok.py)", "podlaga reke + glasba + pripoved = 3"),
        ("zvocni efekti na rezih",
         "DA" if os.path.exists(os.path.join(ZVOK, " efekti")) else "NI"),
        ("pripoved / zrak", f"{pripoved:.2f} s / {zrak:.2f} s "
         f"({pripoved/enota*100:.0f} % zasedeno)" if pripoved else "ni meritve"),
    ])

    # 5. BESEDILO
    anch = {}
    for kid, w, _ in pari:
        a = kadri[kid].get("sidro", "?")
        anch[a] = anch.get(a, 0) + 1
    tabela("5. BESEDILO", [
        ("polozaj", ", ".join(f"{k}:{v}" for k, v in sorted(anch.items(),
                                                            key=lambda x: -x[1]))),
        ("vhod napisov", "fade + translateY(10 px), enak za vse kadre"
         if "translateY(${((1 - Math.min(1, Math.max(0, (s - vhod) / FADE))) * 10)" in js
         else "ni najdeno"),
        ("beseda-po-beseda (kinetic)", "DA" if "besede" in js else "NI"),
    ])

    # 6. ZIVA VSEBINA v kadru
    zivi = [kid for kid, w, _ in pari if kadri[kid]["vrsta"] == "video"]
    tabela("6. ZIVA VSEBINA V KADRU", [
        ("kadri, ki se sami premikajo", f"{len(zivi)} / {len(pari)}  ({', '.join(zivi) or '—'})"),
        ("slicni kadri (mrtva allusa)",
         f"{sum(1 for kid, w, _ in pari if kadri[kid]['vrsta']=='slika')}"),
        ("podnebni/locni premiki (light leak, zrn)",
         "DA" if "zrn" in js or "leak" in js else "NI"),
    ])


if __name__ == "__main__":
    main()
