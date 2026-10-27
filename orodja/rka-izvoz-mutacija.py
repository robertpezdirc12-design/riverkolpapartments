#!/usr/bin/env python3
"""Mutacijski preizkus vrat za izvoz: vsaka napaka mora biti ujeta.

Vrata, ki nikoli ne padejo, ne varujejo nicesar. Vse poteka na KOPIJI v Temp:
Robertove konne datoteke se ne dotaknejo, zato ubit proces ne more pustiti
pokvarjenega izdelka.

raba: python rka-izvoz-mutacija.py
"""
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

PRAVI_IZVOZ = Path(r"C:\Users\admin\Downloads\sssdf\rka-reklama")
PRAVI_SPLAT = Path(r"C:\Users\admin\Downloads\sssdf\rka-onepage")
KOPJA = Path(r"C:\Users\admin\AppData\Local\Temp\rka-izvoz-mut")
SPLAT_KOPIJA = KOPJA / "splat"
ZVOK_KOPIJA = SPLAT_KOPIJA / "zvok"
PREVERI = Path(r"C:\Users\admin\AppData\Local\Temp\rka-izvoz-preveri.py")
FFMPEG = r"C:\Users\admin\.qoder\bin\ffmpeg.exe"


def pripravi():
    KOPJA.mkdir(exist_ok=True)
    ZVOK_KOPIJA.mkdir(parents=True, exist_ok=True)
    for izvor in sorted(PRAVI_IZVOZ.glob("rka-*.mp4")):
        shutil.copy2(izvor, KOPJA / izvor.name)
    for vzorec in ("master-*.m4a", "namera-*.json", "LICENCE.md"):
        for izvor in sorted((PRAVI_SPLAT / "zvok").glob(vzorec)):
            shutil.copy2(izvor, ZVOK_KOPIJA / izvor.name)


def osvezi(*ime):
    """Vrne na kopijo natanko omenjene datoteke, ne celi mape: 300 MB na mutacijo
    bi preizkus zavlekla v neskoncnost."""
    for n in ime:
        for vir, cilj in ((PRAVI_IZVOZ, KOPJA), (PRAVI_SPLAT / "zvok", ZVOK_KOPIJA)):
            if (vir / n).exists():
                shutil.copy2(vir / n, cilj / n)
                break
        else:
            raise SystemExit(f"izvorne datoteke {n} ni najti")


def vse_datoteke():
    """Vsaka datoteka, ki jo katerakoli mutacija pobrska. Cistka pred vsako mutacijo
    ni luxury: brez tega prejsnja mutacija (npr. izbrisane namiere) ostane v kopiji in
    naslednja napaka je prispelek, ne posledica mutacije, ki jo preizusamo."""
    return sorted({n for m in MUTACIJE for n in m[4]})


def zazeni(args):
    e = dict(os.environ)
    e["RKA_IZVOZ"], e["RKA_SPLAT"] = str(KOPJA), str(SPLAT_KOPIJA)
    return subprocess.run([sys.executable, str(PREVERI)] + args, capture_output=True,
                          text=True, encoding="utf-8", errors="replace", env=e)


def ffmpeg_izrez(vir, cilj, sekund):
    """Prepise ciljno datoteko krajso — bytes ostanejo veljavni, trajanje ne.
    ffmpeg zavrača pisanje čez lastno vhodno datoteko ("same as Input #0"), zato
    izrez pride v sosednjo začasnico, ki nato zamenja izvirnik.

    +faststart NI okras: brez njega izrez prepise moov na konec, vrata pa upravičeno
    javijo še "moov ni pred mdat" — mutacija, ki prizadene dve pravili, ne dokaže
    nobenega izolirano."""
    dodatno = ["-movflags", "+faststart"] if cilj.suffix == ".mp4" else []
    začasna = cilj.with_name(cilj.stem + ".izrez" + cilj.suffix)
    r = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
                        "-i", str(vir), "-t", str(sekund), "-c", "copy"] + dodatno + [str(začasna)],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"izrez ni uspel: {r.stderr.strip()[-200:]}")
    if not začasna.exists() or začasna.stat().st_size < 1024:
        raise SystemExit(f"izrez je pustil prazno datoteko {začasna.name}")
    os.replace(začasna, cilj)


def izbrisi_omejevalnik(pot, namen="druzbeno"):
    podatki = json.loads(pot.read_text(encoding="utf-8"))
    vpis = podatki["izvozi"][namen]
    if "omejevalnik" not in vpis:
        raise SystemExit(f"{pot.name}: omejevalnik ni zapisan, mutacija ni mocna")
    del vpis["omejevalnik"]
    pot.write_text(json.dumps(podatki, ensure_ascii=False, indent=1) + "\n",
                   encoding="utf-8", newline="\n")


MUTACIJE = [
    # (ime, mutator, argumenti vrat, prickovani vzrok, datoteke za obnovitev,
    #  dopustne posledice) — zadnje polje loči dve razlicni stvari:
    #  * ostanki prejsnje mutacije = izolacija je pokvarjena = napaka
    #  * prave posledice istega posega = vrata so pravilno glasna vec kot enkrat
    ("prekrajsi izdelek (60 s → 45 s)",
     lambda: ffmpeg_izrez(KOPJA / "rka-60-sl-splet.mp4", KOPJA / "rka-60-sl-splet.mp4", 45),
     ["rka-60-sl-splet.mp4"], r"traja .*naj bi 60s", ["rka-60-sl-splet.mp4"],
     r"zvok se ne ujema z izmerjenim mojstrom"),

    ("zvok ne ustreza izmerjenemu mojstru",
     lambda: ffmpeg_izrez(ZVOK_KOPIJA / "master-60-sl-splet.m4a",
                          ZVOK_KOPIJA / "master-60-sl-splet.m4a", 40),
     ["rka-60-sl-splet.mp4"], r"zvok se ne ujema z izmerjenim mojstrom",
     ["master-60-sl-splet.m4a"]),

    ("druzbeni rez brez dokumentiranega omejevalnika",
     lambda: izbrisi_omejevalnik(ZVOK_KOPIJA / "namera-60-sl.json"),
     ["rka-60-sl-druzbeno.mp4"], r"omejevalnik", ["namera-60-sl.json"]),

    ("namiera manjka",
     lambda: (ZVOK_KOPIJA / "namera-30-en.json").unlink(),
     ["rka-30-en-splet.mp4"], r"manjka namera-30-en", ["namera-30-en.json"]),

    ("tiho izpisena razlicica izgine iz seznama",
     lambda: (KOPJA / "rka-30-en-druzbeno.mp4").unlink(),
     [], r"MANJKA IZVOZ: rka-30-en-druzbeno", ["rka-30-en-druzbeno.mp4"]),

    ("licence ni vec v mapi",
     lambda: (ZVOK_KOPIJA / "LICENCE.md").unlink(),
     [], r"MANJKA LICENCE.md", ["LICENCE.md"]),
]

pripravi()
if len(sys.argv) > 1:
    # Filiter po imenu: celoten preizkus traja četrt ure, popravek ene
    # mutacije pa ga ne sme zahtevati v celoti.
    MUTACIJE = [m for m in MUTACIJE if any(a in m[0] for a in sys.argv[1:])]
    if not MUTACIJE:
        raise SystemExit("nobena mutacija se ne ujema s filtrom")
    print(f"filter {sys.argv[1:]}: {len(MUTACIJE)} mutacij")
r = zazeni([])
if r.returncode != 0:
    print("IZHODIŠČE NI V REDU:\n" + r.stdout + r.stderr)
    sys.exit(1)
print("izhodišče: V REDU (kopija, brez mutacij)")

napake = []
for ime, mutator, argumenti, pricakovano, obnovi, *repa in MUTACIJE:
    dovoljeni = repa[0] if repa else None
    osvezi(*vse_datoteke())
    try:
        mutator()
    except SystemExit as e:
        napake.append(ime)
        print(f"  {ime}: NI IZVEDENA — {e}")
        continue
    r = zazeni(argumenti)
    javljene = re.findall(r"^\s+-\s+(.*)$", r.stdout, re.M)
    if r.returncode == 0:
        napake.append(ime)
        print(f"  {ime}: SPADLO — vrat niso ujela")
    elif not javljene:
        napake.append(ime)
        print(f"  {ime}: PORAČENO Z RUŠITVIJO — pregled ni javil nobene napake, "
              f"izhod {r.returncode}, zadnje: {(r.stdout + r.stderr).strip().splitlines()[-1][:120]}")
    elif not any(re.search(pricakovano, j) for j in javljene):
        napake.append(ime)
        print(f"  {ime}: UJETO DRUGO — pričakovano {pricakovano!r}, "
              f"javljeno {javljene[0][:90]!r}")
    else:
        zadeta = [j for j in javljene if re.search(pricakovano, j)]
        ostali = [j for j in javljene if j not in zadeta
                  and not (dovoljeni and re.search(dovoljeni, j))]
        if ostali:
            napake.append(ime)
            print(f"  {ime}: UJETO Z OSTANKI — javlja še {ostali[0][:90]!r}; "
                  f"to ni posledica tega posega, mutacije niso izolirane")
        else:
            posledice = [j for j in javljene if j not in zadeta]
            print(f"  {ime}: ujeta — {zadeta[0][:100]}" +
                  (f"  (+{len(posledice)} upravičenih posledic)" if posledice else ""))

osvezi(*[n for m in MUTACIJE for n in m[4]])
r = zazeni([])
print(f"\nujetih {len(MUTACIJE) - len(napake)} / {len(MUTACIJE)}, "
      f"kopija po obnovi: {'V REDU' if r.returncode == 0 else 'NI V REDU'}")
if napake:
    print("NI UJETO:", ", ".join(napake))
print("izvoz: " + ("V REDU" if not napake and r.returncode == 0 else "napaka"))
sys.exit(1 if napake or r.returncode else 0)
