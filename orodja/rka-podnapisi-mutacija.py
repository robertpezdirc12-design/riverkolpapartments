#!/usr/bin/env python3
"""Mutacijski preizkus vrat za podnapise: vsaka napaka mora biti ujeta.

Vrata, ki nikoli ne padejo, ne varujejo ničesar. Vsaka mutacija je taka, da je
prejšnja različica preveri (npr. število vrstic ostane enako), da ne zadostuje
kar koli.
"""
import re, subprocess, sys
from pathlib import Path

# Windows konzola je cp1250: brez tega bi bil zapisani dokaz o mutacijah
# nepreberljiv, otrok pa bi se napačno dekodiral.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

VID = Path(r"C:\Users\admin\Downloads\sssdf\rka-reklama")
PREVERI = Path(r"C:\Users\admin\AppData\Local\Temp\rka-podnapisi-preveri.py")
SRT60 = VID / "rka-60-sl-splet.srt"
VTT60 = VID / "rka-60-sl-splet.vtt"
SRT30 = VID / "rka-30-en-splet.srt"
SRT60EN = VID / "rka-60-en-splet.srt"
VTT30 = VID / "rka-30-en-splet.vtt"

# Shranimo VSE stranjske podnapise, ne le tistih, ki jih poznamo zdaj: sicer
# mutacija v datoteki, ki je ni na seznamu, ostane za seboj in naslednji tek
# jo vzame za izhodišče.
originali = {p: p.read_text(encoding="utf-8") for p in sorted(list(VID.glob("rka-*.srt")) + list(VID.glob("rka-*.vtt")))}

def vrni():
    for p, b in originali.items():
        p.write_text(b, encoding="utf-8", newline="\n")

def zamenjaj(pot, vzorec, nadomestilo, flags=0):
    bes = pot.read_text(encoding="utf-8")
    nova, n = re.subn(vzorec, nadomestilo, bes, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f"izvirnika ni najti v {pot.name}: {vzorec}")
    if nova == bes:
        raise SystemExit(f"mutacija {pot.name} ne spremeni datoteke")
    pot.write_text(nova, encoding="utf-8", newline="\n")

def zdruzi(pot, besedilo):
    """Razdvoji vrstico nazaj v eno samo — ujeti jo mora samo pravilo dolžine."""
    a, b = besedilo.split(chr(10))
    zamenjaj(pot, re.escape(a) + chr(10) + re.escape(b), a + " " + b)


def razcepi(pot, besedilo):
    """Iste besede, a v treh vrsticah — besedilo se še vedno glasi enako."""
    a, b = besedilo.split(chr(10))
    prva, druga = b.split(" ", 1)
    zamenjaj(pot, re.escape(a) + chr(10) + re.escape(b),
             chr(10).join([a, prva, druga]))


MUTACIJE = [
    ("zamaknjena ura", lambda: zamenjaj(SRT60, r"00:00:03,405 --> ", "00:00:04,405 --> ")),
    ("izpuščena vrstica", lambda: zamenjaj(VTT60, r"00:00:05\.307 --> 00:00:06\.562\nin si v reki\.\n", "")),
    ("spremenjen izraz", lambda: zamenjaj(SRT60, "Kopanje, ki se ga ne naveličaš\\.", "Kopanje brez konca.")),
    ("prekrivanje", lambda: zamenjaj(SRT60, r"00:00:05,156\n", r"00:00:06,900\n")),
    ("neprevedena vrstica", lambda: zamenjaj(SRT30, "and you are in\.", "in si v reki.")),
    ("napačen Language", lambda: zamenjaj(VTT60, "Language: sl", "Language: hr")),
    ("predolga vrstica", lambda: zamenjaj(SRT30, "Morning begins at the river Kolpa\\.",
                                           "Morning begins right at the river Kolpa downstream")),
    ("prekineš oštevilčenje", lambda: zamenjaj(SRT60, r"\n7\n00:00", "\n07\n00:00")),
    ("ura čez dolžino posnetka", lambda: zamenjaj(SRT30, r"00:00:30,000", "00:01:30,000")),
    ("manjkajoča .vtt", lambda: VTT30.unlink()),
    ("združena vrstica čez 42 znakov",
     lambda: zdruzi(SRT60EN, "Each house with its own" + chr(10) + "terrace and garden.")),
    ("tri vrstice namesto dveh",
     lambda: razcepi(SRT60EN, "Each house with its own" + chr(10) + "terrace and garden.")),
    ("slovenski podnapis brez šumnikov", lambda: zamenjaj(SRT60,
        "Jutro se začne ob reki Kolpi\.", "Jutro se zacne ob reki Kolpi.")),
]

napake = []
vrni()
r = subprocess.run([sys.executable, str(PREVERI)], capture_output=True, text=True,
                   encoding="utf-8", errors="replace")
if r.returncode != 0:
    print("IZHODIŠČE NI V REDU:\n" + r.stdout + r.stderr)
    sys.exit(1)
print("izhodišče: V REDU (brez mutacij)")

ujete = 0
for ime, mutacija in MUTACIJE:
    vrni()
    try:
        mutacija()
    except SystemExit as e:
        napake.append(ime)
        print(f"  {ime}: NI IZVEDENA — {e}")
        continue
    r = subprocess.run([sys.executable, str(PREVERI)], capture_output=True, text=True,
                   encoding="utf-8", errors="replace")
    if r.returncode == 0:
        napake.append(ime)
        print(f"  {ime}: SPADLO — vrat niso ujela")
    else:
        ujeti = re.findall(r"^\s+-\s+(.*)$", r.stdout, re.M)
        if not ujeti:
            napake.append(ime)
            print(f"  {ime}: PORAČENO Z RUŠITVIJO — pregled ni javil nobene napake, izhod {r.returncode}")
            print("    " + (r.stdout + r.stderr).strip().splitlines()[-1][:140])
        else:
            print(f"  {ime}: ujeta — {ujeti[0][:100]}")
    vrni()
vrni()
print(f"\nujetih {len(MUTACIJE) - len(napake)} / {len(MUTACIJE)}")
if napake:
    print("NI UJETO:", ", ".join(napake))
sys.exit(1 if napake else 0)
