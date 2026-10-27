# Mutacijski dokaz za rka-pokonci-preveri.cjs. Vrata so verodostojna šele, ko se
# vidi, da gonejo rdeče prav zaradi tistega, kar varujejo — sedem trditev, sedem
# posegov v izvirnik, vsak sam naj bi obarval nateno svojo vrstico.
#
# Vsaka mutacija: zamenjaj niz, poišči pričakovano sporočilo, obnovi iz spomina
# (nikoli iz git), preveri sha256 in ponovno potrdi, da so vrata spet zelena.
import hashlib
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

RAZ = Path(r"C:\Users\admin\Downloads\sssdf\rka-onepage")
Vrata = Path(r"C:\Users\admin\AppData\Local\Temp\rka-pokonci-preveri.cjs")

MU = [
    # 1) način gane parameter: spuščen varovalni pogovor pade na neznano vrednost
    ("zgodba.js",
     '  if (r !== "9x16" && r !== "16x9") return;',
     '  if (r === "16x9") return;',
     "neznano razmerje",
     "varovalka spuščena: ?razmerje=4x3 bi stran nastavila v poljubno stanje"),
    # 2) živa stran se ne sme spremeniti: pravila brez body.pokonci veljajo vsem
    ("zgodba.css",
     "body.pokonci .k-v{inset:0;width:auto;height:auto}",
     ".k-v{inset:0;width:auto;height:auto}",
     "lezeca zasnova obljublja",
     "pokončni slog je ušel iz področja: ozko okno bi samo odpre pas"),
    # 3) polnilo potuje s kadrom
    ("zgodba.js",
     '    if (nastavek) sloj.style.setProperty("--k-slika", `url("${nastavek}")`);',
     '    if (false && nastavek) sloj.style.setProperty("--k-slika", `url("${nastavek}")`);',
     "polnilo --k-slika manjka",
     "okvir ne nastavi --k-slika: za pasom ni nadaljevanja slike, temveč črno"),
    # 4) pas ne razkrije roba — ožji pas razkrije polnilo ob vsakem premiku
    ("zgodba.css",
     "body.pokonci .k-v img,body.pokonci .k-v video{position:absolute;left:-4%;bottom:40%;\n  width:108%;",
     "body.pokonci .k-v img,body.pokonci .k-v video{position:absolute;left:0;bottom:40%;\n  width:100%;",
     "pas razkrije polnilo",
     "pas zožen na platno: vodoravni Ken Burns potegne zabarvano podlago v kadar"),
    # 5) napis stoji na temnem polju, ne čez sliko
    ("zgodba.css",
     "body.pokonci .napisi{bottom:clamp(64px,9svh,140px)}",
     "body.pokonci .napisi{bottom:clamp(500px,45svh,700px)}",
     "napis sega v pas",
     "napis dvignjen v sliko: beli črkini čez bel vodni pramen"),
    # 6) pas ni črn
    ("zgodba.css",
     "  box-shadow:0 30px 80px 8px rgba(2,8,5,.9)}",
     "  box-shadow:0 30px 80px 8px rgba(2,8,5,.9);filter:brightness(0)}",
     "pas je crn",
     "ostry kader zatemnjen na nič: izvoz bi bil črn pravokotnik na zelenem polju"),
    # 7) temno polje je temnejše od pasu
    ("zgodba.css",
     "  background-image:linear-gradient(180deg,rgba(6,20,16,.52),rgba(2,8,5,.74)),var(--k-slika,none);\n"
     "  background-size:cover;background-position:center;\n"
     "  filter:blur(22px) brightness(.5) saturate(.8)}",
     "  background-image:var(--k-slika,none);\n"
     "  background-size:cover;background-position:center;\n"
     "  filter:blur(22px) brightness(2.4) saturate(1.2)}",
     "temno polje ni temnejse od pasu",
     "brez zatemnitve: pod napisom ostane surova, svetla, zamegljena slika"),
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


def obnovi_vse(izvir):
    for ime, b in izvir.items():
        (RAZ / ime).write_bytes(b)


izviri = sorted({ime for ime, *_ in MU})
izvir = {ime: (RAZ / ime).read_bytes() for ime in izviri}
for ime in izviri:
    print(f"  {ime}: {hashlib.sha256(izvir[ime]).hexdigest()[:12]}")

rc, izpis = zazeni()
print(f"\nizhodna točka: {'V REDU' if rc == 0 else 'NI V REDU'}")
if rc != 0:
    prispevki = napake(izpis)
    print("\n".join("  " + n for n in prispevki) if prispevki else "  (brez razsodbe — zagon je crknil)")
    print(zadnji(izpis))
    sys.exit("Vrata morajo biti zelena, preden jih mutiram.")

slabo = 0
try:
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
        if iz.count(bstaro) > 1:
            print(f"\n  ? {ime}: niz ni enoličen — mutacija NI VELJAVNA ({razlaga})")
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
except BaseException as e:
    obnovi_vse(izvir)
    raise e

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
