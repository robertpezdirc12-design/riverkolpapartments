#!/usr/bin/env python3
# Preizkus izvozenih razlicic: to je vrata pred predajo, ne opis datotek.
#
#   raba: python rka-izvoz-preveri.py [ime1.mp4 ...]
#
# Brez argumentov pregleda vse konzne datoteke rka-*.mp4 v mapi izvoza. Vrstice
# z podcrtajem na zacetku so delovni datoteki (poskusi, piloti, predogledi) in
# ne smejo med izdelek, zato jih namenoma ne steje.
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import glob
import json
import os
import re
import subprocess
import sys

IZVOZ = os.environ.get("RKA_IZVOZ") or r"C:\Users\admin\Downloads\sssdf\rka-reklama"
FFMPEG = r"C:\Users\admin\.qoder\bin\ffmpeg.exe"
SPLAT = os.environ.get("RKA_SPLAT") or r"C:\Users\admin\Downloads\sssdf\rka-onepage"

# Vsak namen ima svoj prag. Vrh se preseka pri cilju plus ena deseta decibela:
# TP razgolicenega zaporedja je lahko malenkost visji od izpisa mojstra.
# "zajezek" = namena ni mogoce doseci z linearnim ojcanjem pod pragom vrha,
# sme torej nastati samo z omejevalnikom. Njegov strop mora biti zapisan v
# namieri; brez zapisa je poseg nedokumentiran in izdelek ni za predajo.
CILJI = {
    "mojster":   {"I": -23.0, "TP": -1.5},
    "splet":     {"I": -16.0, "TP": -1.5},
    "druzbeno":  {"I": -14.0, "TP": -1.5, "zajezek": True},
}


def izvedi(vhodi, enota):
    r = subprocess.run([FFMPEG, "-hide_banner", "-nostdin", "-nostats"] + vhodi,
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise SystemExit(f"{enota}: uka ni uspelo\n{(r.stderr or '')[-500:]}")
    return r.stdout + r.stderr


def tok(pot):
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", pot], capture_output=True,
                       text=True, encoding="utf-8", errors="replace")
    izhod = r.stderr
    vrstica = [v for v in izhod.splitlines() if "Stream #" in v]
    videi = [v for v in vrstica if ": Video:" in v]
    zvoki = [v for v in vrstica if ": Audio:" in v]
    d = re.search(r"Duration: (\d+):(\d+):([\d.]+)", izhod)
    trajanje = int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3)) if d else None
    return trajanje, videi, zvoki


def podatki(vrstica, vzorec):
    m = re.search(vzorec, vrstica)
    return m.groups() if m else None


def hitrost(pot):
    """moov pred mdat = predvajalnik zacne takoj; brez tega se mp4 nalozi v celoti."""
    with open(pot, "rb") as f:
        b = f.read(1 << 20)
    vrsta = []
    i = 0
    while i + 8 <= len(b):
        n = int.from_bytes(b[i:i + 4], "big")
        oznaka = b[i + 4:i + 8].decode("latin-1")
        vrsta.append(oznaka)
        if n < 8:
            break
        i += n
    return vrsta


def glasnost(pot):
    izhod = izvedi(["-i", pot, "-af", "loudnorm=print_format=json", "-f", "null", "-"],
                   "glasnost " + os.path.basename(pot))
    zacetek = izhod.rfind('"input_i"')
    if zacetek < 0:
        raise SystemExit("NI MERITVE GLASNOSTI: " + os.path.basename(pot))
    r = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", izhod[zacetek - 20:])
    j = json.loads(r.group(0))
    return float(j["input_i"]), float(j["input_tp"]), float(j["input_lra"])


def crnina(pot):
    izhod = izvedi(["-i", pot, "-vf", "blackdetect=d=0.10:pix_th=0.10", "-an", "-f", "null", "-"],
                   "crnina " + os.path.basename(pot))
    najdeni = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", izhod)
    return [(float(a), float(b)) for a, b in najdeni]


def odtis_zvoka(pot):
    """Razgolicen zvok kot md5. Dokaze, da izvozenka nosi točno izmerjeni mojster
    in ne katerekoli starejsi posnetek z istim imenom."""
    r = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-nostdin", "-i", pot,
                        "-map", "0:a", "-f", "s16le", "-ac", "1", "-ar", "48000", "-"],
                       capture_output=True)
    if r.returncode != 0:
        raise SystemExit("razgolen zvok ni uspel: " + os.path.basename(pot) + "\n"
                         + r.stderr.decode("utf-8", "replace")[-400:])
    import hashlib
    return hashlib.md5(r.stdout).hexdigest(), len(r.stdout)


def namiera(rez, jezik):
    """Dokaz iz zvocnega cevovoda: kaj je namen moral doseci in s cim.
    Majhna je, zato jo bere vsaka razlicica posebej."""
    pot = os.path.join(SPLAT, "zvok", f"namera-{rez}-{jezik}.json")
    if not os.path.exists(pot):
        return None
    with open(pot, encoding="utf-8") as f:
        return json.load(f)


def preveri(pot):
    ime = os.path.basename(pot)
    napake = []
    m = re.match(r"rka-(\d+)-(sl|en)-(mojster|splet|druzbeno)(-pokonci)?\.mp4$", ime)
    if not m:
        napake.append("ime ne ustreza obrazcu rka-<rez>-<jezik>-<namen>[-pokonci].mp4")
        rez = jezik = namen = None
        pokonci = False
    else:
        rez, jezik, namen = m.group(1), m.group(2), m.group(3)
        # Pokoncna razlicica nosi isti izmerjeni zvok, samo platno je obrnjeno:
        # brez locene zahteve bi pregled zahteval 1920x1080 tudi zanjo.
        pokonci = bool(m.group(4))
    trajanje, videi, zvoki = tok(pot)
    velika = os.path.getsize(pot) / 1048576

    if trajanje is None:
        napake.append("ni mogoce precasati trajanja")
    elif rez and abs(trajanje - float(rez)) > 0.05:
        napake.append(f"traja {trajanje}s, naj bi {rez}s")

    if len(videi) != 1:
        napake.append(f"videnih {len(videi)} vidskih tokov, naj bi en")
    else:
        vrstica = videi[0]
        barve = podatki(vrstica, r"(yuvj?420p)\(([^)]*)\)")
        locljivost = podatki(vrstica, r"(\d{3,4})x(\d{3,4})")
        fps = podatki(vrstica, r"([\d.]+) fps")
        if not locljivost:
            napake.append("ni razlocena locljivost platna")
        elif (int(locljivost[0]), int(locljivost[1])) != ((1080, 1920) if pokonci else (1920, 1080)):
            napake.append(f"platno {locljivost[0]}x{locljivost[1]}, naj bi "
                          f"{'1080x1920' if pokonci else '1920x1080'}")
        if not fps:
            napake.append("ni razlocena hitrost slic")
        elif abs(float(fps[0]) - 30) > 0.01:
            napake.append(f"{fps[0]} fps, naj bi 30")
        if not barve:
            napake.append("ni razlocen pis vzorca")
        else:
            if barve[0] != "yuv420p":
                napake.append(f"vzorec {barve[0]}, naj bi yuv420p "
                              f"(je JPEG polni razpon, ki ga TV narobe razume)")
            if "bt709" not in barve[1]:
                napake.append(f"barvna preslikava '{barve[1]}', naj bi bt709")
            if "tv" not in barve[1]:
                napake.append(f"razpon '{barve[1]}', naj bi tv (ozko), ne pc (polni)")

    if len(zvoki) != 1:
        napake.append(f"videnih {len(zvoki)} zvocnih tokov, naj bi en")
    else:
        vzorec = podatki(zvoki[0], r"(\d+) Hz, (\w+)")
        if not vzorec:
            napake.append("ni razlocen zvocni vzorec")
        elif int(vzorec[0]) != 48000 or vzorec[1] != "stereo":
            napake.append(f"zvok {vzorec[0]} Hz {vzorec[1]}, naj bi 48000 Hz stereo")

    vrste = hitrost(pot)
    if "moov" not in vrste or (vrste.index("moov") if "moov" in vrste else 99) > \
            (vrste.index("mdat") if "mdat" in vrste else 99):
        napake.append("moov ni pred mdat — datoteka ni za postrezovanje v toku")

    i, tp, lra = glasnost(pot)
    if rez and namen in CILJI:
        cilj = CILJI[namen]
        if abs(i - cilj["I"]) > 0.6:
            napake.append(f"I = {i} LUFS, cilj {cilj['I']}")
        if tp > cilj["TP"] + 0.1:
            napake.append(f"true peak {tp} dBFS, naj ne presega {cilj['TP']}")

    if rez and jezik and namen:
        mojster = os.path.join(SPLAT, "zvok", f"master-{rez}-{jezik}-{namen}.m4a")
        if not os.path.exists(mojster):
            napake.append(f"manjka izmerjeni mojster {os.path.basename(mojster)}")
        else:
            a, _ = odtis_zvoka(pot)
            b, _ = odtis_zvoka(mojster)
            if a != b:
                napake.append(f"zvok se ne ujema z izmerjenim mojstrom "
                              f"({a[:8]} != {b[:8]})")

    if rez and jezik and namen:
        nm = namiera(rez, jezik)
        if nm is None:
            napake.append(f"manjka namera-{rez}-{jezik}.json — namena ni mogoce preveriti")
        else:
            vpis = (nm.get("izvozi") or {}).get(namen)
            if not vpis:
                napake.append(f"v nameri {jezik}:{rez} ni zapisa o namenu {namen}")
            else:
                if vpis.get("odstopanje"):
                    napake.append(f"ze izmerjeni mojster prijavlja odstopanje: "
                                  f"{vpis['odstopanje']}")
                cilj = CILJI.get(namen) or {}
                if cilj.get("zajezek"):
                    meja = vpis.get("omejevalnik")
                    if not isinstance(meja, (int, float)) or not -12 < meja < 0:
                        napake.append(f"{namen} sme nastati samo z dokumentiranim "
                                      f"omejevalnikom (strop med -12 in 0 dBFS), "
                                      f"v zapisu: {meja!r}")

    crni = crnina(pot)
    nepripraveni = [(a, b) for a, b in crni if a > 0.6 and b < (trajanje or 1e9) - 0.6]
    if nepripraveni:
        napake.append("crni kadri sredi spota: " +
                      ", ".join(f"{a:.2f}-{b:.2f}s" for a, b in nepripraveni))

    print(f"  {ime:<28} {trajanje:>6.2f}s  {velika:>5.1f} MB  "
          f"I={i:>6.2f}  TP={tp:>5.2f}  LRA={lra:>4.2f}  "
          f"crno {len(crni)}  " + ("OK" if not napake else "NEOK"))
    for n in napake:
        print("      - " + n)
    return napake


datoteke = sys.argv[1:] or sorted(glob.glob(os.path.join(IZVOZ, "rka-*.mp4")))
if not datoteke:
    raise SystemExit("v mapi izvoza ni koncnih datotek")
# Tiho izpiscena razlicica je napaka, ki je pregled posamicne datoteke ne more
# zaznati: datoteka je lahko brezhibna, seznam izdelkov pa kljun manjkajoc.
# Velja samo ob celotnem pregledu mape, ne pri rocno podanih imenih.
PRICAKOVANE = [f"rka-{r}-{j}-{n}.mp4"
               for r in ("60", "30") for j in ("sl", "en")
               for n in (("mojster", "splet", "druzbeno") if j == "sl"
                         else ("splet", "druzbeno"))]
# Pokoncna razlicica ima na vsakem platnu eno samo namembnost: navpicni tok.
# Mojster in splet ostaneta lezeca, ker ju je na tistem platnu odobril Robert.
PRICAKOVANE += [f"rka-{r}-{j}-druzbeno-pokonci.mp4"
                for r in ("60", "30") for j in ("sl", "en")]
licenca = os.path.join(SPLAT, "zvok", "LICENCE.md")
print(f"datotek v pregledu: {len(datoteke)}")
napake = []
for pot in datoteke:
    # Rocno podano ime lahko stojí izven mape izvoza: razresimo ga, ne pademo.
    if not os.path.exists(pot):
        pot = os.path.join(IZVOZ, os.path.basename(pot))
    if not os.path.exists(pot):
        napake.append(f"{os.path.basename(pot)}: datoteke ni — nic se ne da preveriti")
        continue
    try:
        rezultat = preveri(pot)
    except Exception as e:
        # Zruseno vrat ni rdec signals: brez vrstice bi izsledek izgladil kot
        # "nic najdenega", kar je najslabsa mozna lazn.
        napake.append(f"{os.path.basename(pot)}: PREGLED NI IZVEDLJIV — "
                      f"{type(e).__name__}: {e}")
        continue
    for n in rezultat:
        napake.append(f"{os.path.basename(pot)}: {n}")
if not sys.argv[1:]:
    for manjka in [p for p in PRICAKOVANE
                   if p not in {os.path.basename(x) for x in datoteke}]:
        napake.append(f"MANJKA IZVOZ: {manjka}")
if not os.path.exists(licenca):
    napake.append("MANJKA LICENCE.md — izdelka ni smelo objaviti")
else:
    besedilo = open(licenca, encoding="utf-8").read()
    if "Wholesome" not in besedilo:
        napake.append("LICENCE.md ne omenja izbrane skladbe")
if napake:
    print("\nIZVOZ NI PRIPRAVLJEN:")
    for n in napake:
        print("  - " + n)
    raise SystemExit(1)
print("\nVSE OK: trajanje, platno, zvok, barve, tok in glasnost so po merilih.")
