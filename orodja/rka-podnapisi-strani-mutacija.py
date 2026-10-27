# Mutacijski dokaz za rka-podnapisi-strani-preveri.cjs. Vrata so verodostojna
# šele, ko se vidi, da gonejo rdeče prav zaradi tistega, kar varujejo.
#
# Vsaka mutacija: zamenjaj niz, poišči pričakovano sporočilo, obnovi iz spomina
# (nikoli iz git), preveri sha256 in ponovno potrdi, da so vrata spet zelena.
import hashlib
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

RAZ = Path(r"C:\Users\admin\Downloads\sssdf\rka-onepage")
Vrata = Path(r"C:\Users\admin\AppData\Local\Temp\rka-podnapisi-strani-preveri.cjs")

MU = [
    ("zgodba.js", "  izrisPodnapis(s);", "",
     "se ne ujema z datoteko",
     "crta se ne riše nikoli: besedilo iz .vtt nikoli ne pride na platno"),
    ("zgodba.js",
     "const aktivni = cueji.filter(k => s >= k.startTime && s < k.endTime);",
     "const aktivni = cueji.filter(k => s >= k.startTime);",
     "v praznosti ob",
     "spuščena meja konca: zadnje besedilo ostane na ekranu do konca filma"),
    ("zgodba.js",
     "nova.src = `podnapisi/rka-${stanje.rez}-${stanje.jezik}-splet.vtt`;",
     "nova.src = `podnapisi/rka-${stanje.rez}-sl-splet.vtt`;",
     "sled kaže na drugo datoteko",
     "jezik se ne upošteva: angleški film bi nosil slovensko sled"),
    ("zgodba.js",
     '  nova.track.mode = "hidden";',
     "",
     "cue-jev iz datoteke",
     "sled ostane izklopljena: brskalnik je nikoli ne naloži, crta je prazna"),
    ("zgodba.js",
     '  document.body.classList.toggle("podnapisi-on", stanje.podnapisi);',
     "",
     "crta je skrita, čeprav je vklopljena",
     "gumb vklopi besedilo, a ne CSS-razreda: obiskovalec nikoli nič ne vidi"),
    ("zgodba.js",
     "const aktivni = cueji.filter(k => s >= k.startTime && s < k.endTime);",
     "const aktivni = cueji.filter(k => s >= k.startTime && s <= k.endTime);",
     "ob koncu reza",
     "vključen končni rob: zadnja vrstica preživi zadnji kader filma"),
    ("zgodba.js",
     'podnapisi: false,',
     'podnapisi: true,',
     "podnapisi niso opt-in",
     "crta se prižge sama: zasnovani naslov kadra dobi dvakrat isto besedilo"),
]


def zazeni():
    r = subprocess.run(["node", str(Vrata)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def napake(izpis):
    return [v.strip()[5:] for v in izpis.splitlines() if v.strip().startswith("NAP:")]


def zadnji(izpis, n=12):
    """Kriz brez razsodbe ne sme ostati neviden: brez tega bi SMRT izgledala kot
       tiha rdeča vrata, ne kot pokvarjen zagon."""
    vrstice = [v for v in izpis.splitlines() if v.strip()]
    return "\n".join("     " + v for v in vrstice[-n:])


izvir = {ime: (RAZ / ime).read_bytes() for ime, _, _, _, _ in MU}
for ime, b in izvir.items():
    print(f"  {ime}: {hashlib.sha256(b).hexdigest()[:12]}")

rc, izpis = zazeni()
print(f"\nizhodna točka: {'V REDU' if rc == 0 else 'NI V REDU'}")
if rc != 0:
    prispevki = napake(izpis)
    print("\n".join("  " + n for n in prispevki) if prispevki else "  (brez razsodbe — zagon je crknil)")
    print(zadnji(izpis))
    sys.exit("Vrata morajo biti zelena, preden jih mutiram.")

slabo = 0
for ime, staro, novo, sporo, razlaga in MU:
    pot = RAZ / ime
    bstaro, bnovo = staro.encode("utf-8"), novo.encode("utf-8")
    iz = izvir[ime]
    if bstaro not in iz:
        print(f"\n  ? {ime}: izvirnika ni v datoteki — mutacija NI VELJAVNA ({razlaga})")
        slabo += 1
        continue
    if bstaro == bnovo:
        print(f"\n  ? {ime}: mutacija ne spremeni ničesar — ni dokaz")
        slabo += 1
        continue
    popacen = iz.replace(bstaro, bnovo, 1)
    if popacen == iz:
        print(f"\n  ? {ime}: datoteka po mutaciji je identična — mutacija ni veljavna")
        slabo += 1
        continue
    pot.write_bytes(popacen)
    try:
        rc, izpis = zazeni()
        najdeno = [n for n in napake(izpis) if sporo in n]
        ujet = rc != 0 and najdeno
        print(f"\n  {'UJETA' if ujet else 'SPODKLIPLA'}  {ime}: {razlaga}")
        for n in napake(izpis)[:4]:
            print("     " + n)
        if not ujet:
            slabo += 1
            if rc == 0:
                print("     (vrata ostala zelena — mutacija ni dokaz ničesar)")
            elif not najdeno:
                print(f"     (rdeca, a ne zaradi '{sporo}'; zadnji izpis)")
                print(zadnji(izpis))
    finally:
        pot.write_bytes(iz)
        obnovljen = pot.read_bytes()
        if hashlib.sha256(obnovljen).hexdigest() != hashlib.sha256(iz).hexdigest():
            print(f"     KATASTROFA: {ime} se ni obnovil iz spomina!")
            slabo += 1

rc, izpis = zazeni()
print(f"\nobnovljeno stanje: {'V REDU' if rc == 0 else 'NI V REDU'}")
if rc != 0:
    for n in napake(izpis)[:6]:
        print("  " + n)
    if not napake(izpis):
        print(zadnji(izpis))
    slabo += 1
for ime, b in izvir.items():
    trenutni = (RAZ / ime).read_bytes()
    if hashlib.sha256(trenutni).hexdigest() != hashlib.sha256(b).hexdigest():
        print(f"KATASTROFA: {ime} se razlikuje od izvora!")
        slabo += 1

print(f"\n{len(MU) - slabo}/{len(MU)} mutacij ujetih")
sys.exit(1 if slabo else 0)
