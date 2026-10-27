# Mutacijski dokaz za rka-ozadje-proveri.cjs. Vrata so verodostojna šele, ko se
# vidi, da gonejo rdeče prav zaradi tistega, kar varujejo.
#
# Vsaka mutacija: zamenjaj dol, poišči EXPECTIRANO sporočilo, obnovi iz spomina
# (nikoli iz git), preveri sha256 in ponovno potrdi, da so vrata spet zelena.
import hashlib
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

RAZ = Path(r"C:\Users\admin\Downloads\sssdf\rka-onepage")
Vrata = Path(r"C:\Users\admin\AppData\Local\Temp\rka-ozadje-proveri.cjs")

MU = [
    ("index.html", 'preload="none"', 'preload="metadata"',
     "YouTube deluje, strežnik pa je vseeno oddal",
     "preload nazaj na metadata: cela datoteka gre skozi žep"),
    ("app.js",
     "if (!youtube && (ytManjka || !ytPlast)) bg.play().catch(() => {});",
     "if (false) bg.play().catch(() => {});",
     "rezerva je mrtva",
     "izklopljen rezervni zagon: ob blokiranem YouTubeu ostane prazno ozadje"),
    ("app.js",
     "if (!youtube && (ytManjka || !ytPlast)) bg.play().catch(() => {});",
     "if (!youtube) bg.play().catch(() => {});",
     "Prihranek ni dokazan",
     "vratiti eager play: zanka se prenese, čeprav jo YouTube prekrije"),
    ("app.js", "const YT_ROK = 9000;", "const YT_ROK = 3000;",
     "rok pa je kljub zgodnejši zmagi vžgal lokalno zanko",
     "rok pod realno časovnico YouTubea: rezerva steče, čeprav plast pride minuto kasneje"),
]


def zagon():
    r = subprocess.run(["node", str(Vrata)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def napake(izpis):
    return [v.strip()[5:] for v in izpis.splitlines() if v.strip().startswith("NAP:")]


def zadnji(izpis, n=12):
    """Kriz brez razsodbe ne sme ostati neviden: brez te funkcije bi SMRT ali
       IZJEMA izgledala kot tiha rdeča vrata, ne kot pokvarjen zagon."""
    vrstice = [v for v in izpis.splitlines() if v.strip()]
    return "\n".join("     " + v for v in vrstice[-n:])


izvir = {ime: (RAZ / ime).read_bytes() for ime, _, _, _, _ in MU}
for ime, b in izvir.items():
    print(f"  {ime}: {hashlib.sha256(b).hexdigest()[:12]}")

rc, izpis = zagon()
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
        rc, izpis = zagon()
        najdeno = [n for n in napake(izpis) if sporo in n]
        ujet = rc != 0 and najdeno
        print(f"\n  {'UJETA' if ujet else 'SPODKLIPLA'}  {ime}: {razlaga}")
        for n in napake(izpis):
            print("     " + n)
        if not ujet:
            slabo += 1
            if rc != 0 and not napake(izpis):
                print("     (brez razsodbe — zagon je crknil, mutacija ni ovrednotena)")
                print(zadnji(izpis))
            elif rc != 0:
                print(f"     (vrata so sicer rdeča, a ne zaradi pričakovanega sporočila '{sporo}')")
    finally:
        pot.write_bytes(iz)
        obnovljen = pot.read_bytes()
        if hashlib.sha256(obnovljen).hexdigest() != hashlib.sha256(iz).hexdigest():
            print(f"     KATASTROFA: {ime} se ni obnovil iz spomina!")
            slabo += 1

rc, izpis = zagon()
print(f"\nobnovljeno stanje: {'V REDU' if rc == 0 else 'NI V REDU'}")
if rc != 0:
    for n in napake(izpis):
        print("  " + n)
    slabo += 1
for ime, b in izvir.items():
    trenutni = (RAZ / ime).read_bytes()
    if hashlib.sha256(trenutni).hexdigest() != hashlib.sha256(b).hexdigest():
        print(f"KATASTROFA: {ime} se razlikuje od izvora!")
        slabo += 1

print(f"\n{len(MU) - slabo}/{len(MU)} mutacij ujetih")
sys.exit(1 if slabo else 0)
