#!/usr/bin/env python3
# Mux: že izvoženo tiho platno + že izmerjeni mojster.
#
#   raba: python rka-mux.py 60 sl
#         python rka-mux.py 60 sl --namen=druzbeno
#         python rka-mux.py --vse
#
# Slike se ne renderira na novo: platno je že dokazano (rka-render.cjs), zato
# sme novi namen pasteti čez isti videotok. Muxa se samo s `-c copy`, torej se
# platu ne zgodi nič; spremeni se le zvojni tok.
#
# Namenske tabele so ene same in jih prebere tudi izvoznik — sicer bi imela dva
# ulaza različico, kateri nameni sploh obstajajo.
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import glob
import json
import os
import re
import subprocess
import sys

SPLAT = r"C:\Users\admin\Downloads\sssdf\rka-onepage"
IZVOZ = r"C:\Users\admin\Downloads\sssdf\rka-reklama"
FFMPEG = r"C:\Users\admin\.qoder\bin\ffmpeg.exe"
TABELA = {"sl": ["mojster", "splet", "druzbeno"], "en": ["splet", "druzbeno"]}
# Pokoncna razlicica se muxa samo za druzbeni tok: mojster in splet sta odobrena
# na lezecem platnu, njuna navpicna različica bi bila nov izdelek.
POKONCI = "--razmerje=9x16" in sys.argv
OZNAKA = "-pokonci" if POKONCI else ""
TABELA_POKONCI = {"sl": ["druzbeno"], "en": ["druzbeno"]}
PLATNO = "_video-{rez}-{jezik}" + OZNAKA + "-jpg.mp4"


def izvedi(vhodi, enota):
    with open(os.devnull, "wb") as tiho:
        p = subprocess.run([FFMPEG, "-hide_banner", "-nostdin", "-loglevel", "error", "-y"]
                           + vhodi, stdin=subprocess.DEVNULL, stdout=tiho, stderr=subprocess.PIPE,
                           timeout=600)
    if p.returncode != 0:
        raise SystemExit(f"{enota}: {p.stderr.decode('utf-8', 'replace')[-400:]}")


def dolzina(pot):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", pot],
                       stdin=subprocess.DEVNULL, capture_output=True, timeout=120)
    if r.returncode != 0:
        raise SystemExit(f"ffprobe ne prebere {pot}")
    return round(float(r.stdout.decode().strip()), 3)


def mux(rez, jezik, nameni):
    platno = os.path.join(IZVOZ, PLATNO.format(rez=rez, jezik=jezik))
    if not os.path.exists(platno):
        raise SystemExit(f"NEDOSTAJA PLATNO {platno} — najprej ga izvozi z rka-render.cjs")
    seznam = os.path.join(SPLAT, "zvok", f"namera-{rez}-{jezik}.json")
    if not os.path.exists(seznam):
        raise SystemExit(f"NEDOSTAJA ČASOVNI LIST {seznam} — brez njega ne vem, kaj je izmerjeno")
    with open(seznam, encoding="utf-8") as f:
        lista = json.load(f)
    enota = float(lista["enota"])
    if abs(dolzina(platno) - enota) > 0.12:
        raise SystemExit(f"PLATNO {rez}/{jezik} traja {dolzina(platno)}s, seznam pravi {enota}s")
    for namen in nameni:
        mojster = os.path.join(SPLAT, "zvok", f"master-{rez}-{jezik}-{namen}.m4a")
        if not os.path.exists(mojster):
            raise SystemExit(f"NEDOSTAJA MOJSTER {namen} za {rez}/{jezik}: {mojster}")
        zapis = lista["izvozi"].get(namen)
        if not zapis:
            raise SystemExit(f"Namena {namen} ni v časovnem listu {rez}/{jezik} — "
                             f"najprej ga izmeri z rka-zvok.py")
        if zapis.get("odstopanje"):
            raise SystemExit(f"Namenu {namen} {rez}/{jezik} piše odstopanje "
                             f"'{zapis['odstopanje']}' — nezmerjenega mojstra ne muxam")
        izhod = os.path.join(IZVOZ, f"rka-{rez}-{jezik}-{namen}{OZNAKA}.mp4")
        izvedi(["-i", platno, "-i", mojster, "-map", "0:v:0", "-map", "1:a:0",
                "-c", "copy", "-shortest", "-movflags", "+faststart", izhod],
               f"mux {os.path.basename(izhod)}")
        dej = dolzina(izhod)
        if abs(dej - enota) > 0.12:
            raise SystemExit(f"{os.path.basename(izhod)} traja {dej}s, naj bi {enota}s")
        print(f"  + {os.path.basename(izhod):<26} {dej:>6.2f}s  "
              f"{os.path.getsize(izhod) / 1048576:>5.1f} MB  "
              f"I={zapis['izmerjeno']['I']}")


para = [a for a in sys.argv[1:] if not a.startswith("--")]
izbrani = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--namen=")), None)
if "--vse" in sys.argv:
    kombinacije = []
    for pot in sorted(glob.glob(os.path.join(IZVOZ, "_video-*-*.mp4"))):
        m = re.match(r"_video-(\d+)-(sl|en)-.*\.mp4$", os.path.basename(pot))
        # Platen obeh razmerij stojijo v isti mapi: brez filtra bi navpicni
        # izvoz muxal s lezeco sliko in obratno.
        if m and ("-pokonci" in os.path.basename(pot)) == POKONCI:
            kombinacije.append((m.group(1), m.group(2)))
elif len(para) >= 2:
    kombinacije = [(para[0], para[1])]
else:
    raise SystemExit("raba: python rka-mux.py <rez> <jezik> [--namen=...] | --vse")
for rez, jezik in kombinacije:
    nameni = [izbrani] if izbrani else (TABELA_POKONCI if POKONCI else TABELA)[jezik]
    print(f":{rez} {jezik}  nameni {', '.join(nameni)}")
    mux(rez, jezik, nameni)
print("\nmuxanih kombinacij:", len(kombinacije))
