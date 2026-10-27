#!/usr/bin/env python3
"""Preveri stranjske podnapise proti izmerjenemu časovnemu listu.

Vsaka trditev v .srt/.vtt se mora glasi enako kot namera-<rez>-<jezik>.json, ki
nastane iz merjenja valovne oblike. Podnapis, ki ga ni v listu, je izmišljen.
"""
import glob, json, re, subprocess, sys
from pathlib import Path

# Podnapisi so slovenski, konzola pa cp1250: brez tega se šumniki v izpisu
# pokvarijo in zapisan dokaz ni več berljiv.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

STR = Path(r"C:\Users\admin\Downloads\sssdf\rka-onepage")
VID = Path(r"C:\Users\admin\Downloads\sssdf\rka-reklama")
SLOVENSKE = set("čšžćČŠŽĆ")
NAJDALEJ = 42

napake = []
def nap(c): napake.append(c)

def pretvori(s):
    h, m, rest = s.split(":")
    return int(h) * 3600 + int(m) * 60 + float(rest.replace(",", "."))

def razčleni_srt(pot):
    pot = Path(pot)
    vrsta = re.split(r"\r?\n\r?\n", Path(pot).read_text(encoding="utf-8").strip())
    cues = []
    for i, b in enumerate(vrsta):
        vr = b.splitlines()
        if len(vr) < 2:
            nap(f"{pot.name}: vrstica {i + 1} nima časa")
            continue
        if vr[0].strip() != str(i + 1):
            nap(f"{pot.name}: vrstica {i + 1} ni oštevilčena zaporedno ({vr[0]!r})")
        m = re.fullmatch(r"(\d\d:\d\d:\d\d,\d\d\d) --> (\d\d:\d\d:\d\d,\d\d\d)", vr[1].strip())
        if not m:
            nap(f"{pot.name}: vrstica {i + 1} neveljaven časovni zapis {vr[1]!r}")
            continue
        cues.append((pretvori(m.group(1)), pretvori(m.group(2)),
                     " ".join(vr[2:]), vr[2:]))
    return cues

def razčleni_vtt(pot):
    pot = Path(pot)
    besedilo = Path(pot).read_text(encoding="utf-8")
    if not besedilo.startswith("WEBVTT"):
        nap(f"{pot.name}: manjka glava WEBVTT")
    jezik_vtt = re.search(r"^Language: (\w\w)", besedilo, re.M)
    cues = []
    if "\n\n" not in besedilo:
        nap(f"{pot.name}: datoteka nima nobene vrstice")
        return [], (jezik_vtt.group(1) if jezik_vtt else None)
    for b in re.split(r"\r?\n\r?\n", besedilo.split("\n\n", 1)[1].strip()):
        vr = b.splitlines()
        m = re.fullmatch(r"(\d\d:\d\d:\d\d\.\d\d\d) --> (\d\d:\d\d:\d\d\.\d\d\d)", vr[0].strip())
        if not m:
            nap(f"{pot.name}: neveljaven časovni zapis {vr[0]!r}")
            continue
        cues.append((pretvori(m.group(1)), pretvori(m.group(2)),
                     " ".join(vr[1:]), vr[1:]))
    return cues, (jezik_vtt.group(1) if jezik_vtt else None)

def dolžina(mp4):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", str(mp4)], capture_output=True, text=True)
    return float(r.stdout.strip())

for rez, jezik in [("60", "sl"), ("60", "en"), ("30", "sl"), ("30", "en")]:
    lista = json.loads((STR / "zvok" / f"namera-{rez}-{jezik}.json").read_text(encoding="utf-8"))["vrstice"]
    vzorec = sorted(glob.glob(str(VID / f"rka-{rez}-{jezik}-*.srt")))
    if not vzorec:
        nap(f"{rez}-{jezik}: noben .srt za obstoječe posnetke")
        continue
    for srt in vzorec:
        ime = Path(srt).stem
        for pot, vrsta in [(srt, "srt"), (str(Path(srt).with_suffix(".vtt")), "vtt")]:
            if not Path(pot).exists():
                nap(f"{Path(pot).name}: manjka datoteka")
                continue
            if vrsta == "srt":
                cues, jezik_datoteke = razčleni_srt(pot), jezik
            else:
                cues, jezik_datoteke = razčleni_vtt(pot)
            if jezik_datoteke != jezik:
                nap(f"{Path(pot).name}: jezik {jezik_datoteke!r}, pričakovano {jezik}")
            mp4 = Path(VID) / (ime + ".mp4")
            if not mp4.exists():
                nap(f"{ime}: podnapis brez posnetka")
                continue
            trajanje = dolžina(mp4)
            if len(cues) != len(lista):
                nap(f"{Path(pot).name}: {len(cues)} vrstic, seznam ima {len(lista)}")
                continue
            prejšnji_konec = -1.0
            for i, (r, (zac, konec, tekst, vr_tekst)) in enumerate(zip(lista, cues)):
                if abs(zac - r["zac"]) > 0.0011:
                    nap(f"{Path(pot).name}:{i + 1} začetek {zac} != izmerjen {r['zac']}")
                expected_konec = r["kader_konec"]
                if i + 1 < len(lista):
                    expected_konec = min(expected_konec, lista[i + 1]["zac"] - 0.001)
                if abs(konec - expected_konec) > 0.0011:
                    nap(f"{Path(pot).name}:{i + 1} konec {konec} != {round(expected_konec, 3)}")
                if tekst != r["besedilo"]:
                    nap(f"{Path(pot).name}:{i + 1} besedilo se ne glasi kot v seznamu:\n"
                        f"    v listu:  {r['besedilo']!r}\n    v podnapisu: {tekst!r}")
                if zac <= prejšnji_konec:
                    nap(f"{Path(pot).name}:{i + 1} se prekriva s prejšnjo vrstico")
                prejšnji_konec = konec
                if konec > trajanje + 0.01:
                    nap(f"{Path(pot).name}:{i + 1} konec {konec} presega dolžino posnetka {trajanje}")
                if len(vr_tekst) > 2:
                    nap(f"{Path(pot).name}:{i + 1} ima {len(vr_tekst)} vrsticah, največ dve")
                for vrstica in vr_tekst:
                    if len(vrstica) > NAJDALEJ:
                        nap(f"{Path(pot).name}:{i + 1} vrsta dolga {len(vrstica)} znakov: {vrstica!r}")
            if jezik == "en":
                neprevedene = [t for *_, t, _v in cues if set(t) & SLOVENSKE]
                if neprevedene:
                    nap(f"{Path(pot).name}: angleški podnapis ima slovenske črke v "
                        f"{len(neprevedene)} vrsticah (neprevedeno): {neprevedene[0]!r}")
            else:
                if not any(set(t) & SLOVENSKE for *_, t, _v in cues):
                    nap(f"{Path(pot).name}: slovenski podnapis nima nobene slovenske črke")

for mp4 in sorted(glob.glob(str(VID / "rka-*-*.mp4"))):
    ime = Path(mp4).stem
    if not re.fullmatch(r"rka-\d\d-(sl|en)-\w+", ime):
        continue
    for kon in ("srt", "vtt"):
        if not Path(VID / f"{ime}.{kon}").exists():
            nap(f"{ime}: manjka .{kon}")

print(f"podnapisi: {'V REDU' if not napake else str(len(napake)) + ' NAPAK'}")
for n in napake[:24]:
    print(" -", n)
sys.exit(1 if napake else 0)
