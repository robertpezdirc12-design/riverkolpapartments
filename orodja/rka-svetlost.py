# Berljivost čez več trenutkov zanke + svetlost. Zunanje orodje, ne del strani.
# Kontrast je izračunan iz DEJANSKO izrisanih barv in velikosti pisave (WCAG 1.4.3):
# meja je 4.5 ali 3.0 za veliko pisavo (>=24px ali >=18.66px krepko).
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json, sys, glob, re
from PIL import Image
import numpy as np

TEMP = r"C:\Users\admin\AppData\Local\Temp"
oznaka = sys.argv[1] if len(sys.argv) > 1 else "pot"
m = json.load(open(rf"{TEMP}\rka-rects-{oznaka}.json", encoding="utf-8"))
W, H = m["w"], m["h"]

def Y(p):
    lin = np.where(p <= 0.04045, p / 12.92, ((p + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]

def Lz(v):
    return np.where(v > 0.008856, 116 * np.cbrt(v) - 16, 903.3 * v)

def nalozi(ime):
    return np.asarray(Image.open(rf"{TEMP}\rka-shot\s-{oznaka}-{m['zaslon']}-{ime}.png").convert("RGB"),
                      dtype=np.float64) / 255.0

# Ime zaslona lahko vsebuje črko t ("telefon"), zato trenutek beremo iz obraza
# s konca imena, ne s prvega "-t".
stevec = lambda pot: int(re.search(r"-t(\d+)-ozadje\.png$", pot).group(1))
trenutki = sorted(glob.glob(rf"{TEMP}\rka-shot\s-{oznaka}-{m['zaslon']}-t*-ozadje.png"), key=stevec)
# Meritev, ki nič ne pregleda, ne sme sporočiti "brez napak".
najmanj = 1 if m.get("mirno") else 4
if m["vir"] != "video" or m["trajanje"] is None or len(trenutki) < najmanj or len(m["pravi"]) < 25:
    raise SystemExit(f"MERITEV NEVELJAVNA: vir={m['vir']} trajanje={m['trajanje']} "
                     f"trenutkov={len(trenutki)} (zahtevanih {najmanj}) pravokotnikov={len(m['pravi'])} — "
                     f"nic ni bilo izmerjeno, ne trdi nicesar.")

polno, golo = nalozi("polno"), nalozi("golo")
ozadjja = [(str(stevec(p)),
            np.asarray(Image.open(p).convert("RGB"), dtype=np.float64) / 255.0) for p in trenutki]

def rez(slika, r, vt=0):
    """Pravokotniki so v CSS px, posnetek v fizicnih — uskladi po razmerju."""
    f = slika.shape[1] / W
    y, x = int(max(r["y"] + vt, 0) * f), int(max(r["x"] + vt, 0) * f)
    y2, x2 = int(min(r["y"] + r["h"] - vt, H) * f), int(min(r["x"] + r["w"] - vt, W) * f)
    return slika[y:max(y2, y + 1), x:max(x2, x + 1)]

def kontrast(r, ozadje):
    """5. percentila najslabših pik: vogali zaobljenih gumbov in lastni okrasi
    elementa (črtica pred eyebrow, rob citata) so v pravokotniku, ne pod črkami."""
    merilo = 3.0 if r["velika"] else 4.5
    vt = min(9, int(0.16 * min(r["w"], r["h"])))
    blok = rez(ozadje, r, vt)
    if blok.size == 0:
        blok = rez(ozadje, r)
    barva = np.array(r["barva"]) / 255.0
    eff = r["alfa"] * barva + (1 - r["alfa"]) * blok          # CSS meša v gamma-prostoru
    ye, yo = Y(eff), Y(blok)
    a = (np.maximum(ye, yo) + 0.05) / (np.minimum(ye, yo) + 0.05)
    return float(np.percentile(a, 5)), float(np.median(yo)), merilo

print(f"\n=== {oznaka}  {m['zaslon']} {W}x{H}  {m['pogled']}  vir={m['vir']} "
      f"trajanje={m['trajanje']}s  trenutkov={len(ozadjja)} ===")
print(f"{'podrocje':<34}{'px/utez':>10}{'L* podl.':>10}{'L* vir':>8}{'kontr.':>8}{'merilo':>8}")
slabi, vrstice = [], []
for r in m["pravi"]:
    vsi = [kontrast(r, o) for _, o in ozadjja]
    kmin = min(v[0] for v in vsi)
    ymed = float(np.mean([v[1] for v in vsi]))
    merilo = vsi[0][2]
    if kmin < merilo:
        slabi.append(f"{r['ozn']} {kmin:.2f}<{merilo:.1f}")
    vrstice.append((kmin - merilo, f"{('!! ' if kmin < merilo else '   ') + r['ozn']:<34}"
                    f"{str(r['px']) + '/' + str(r['utez']):>10}{float(Lz(ymed)):>10.1f}"
                    f"{float(Lz(Y(rez(golo, r)).mean())):>8.1f}{kmin:>8.2f}{merilo:>8.1f}"))
for _, v in sorted(vrstice)[:20]:
    print(v)
print(f"... pregledanih podrocij: {len(m['pravi'])}")

print(f"\nL* celega zaslona:  polno={float(Lz(Y(polno)).mean()):.1f}   "
      f"ozadje v povprecju={float(np.mean([Lz(Y(o)).mean() for _, o in ozadjja])):.1f}   golo={float(Lz(Y(golo)).mean()):.1f}")
desno = {"x": int(W * 0.62), "y": int(H * 0.05), "w": int(W * 0.38), "h": int(H * 0.9)}
print(f"L* desnega dela (odprta voda):  izris={float(Lz(Y(rez(polno, desno))).mean()):.1f}   golo={float(Lz(Y(rez(golo, desno))).mean()):.1f}")
print("SLABI KONTRASTI:", slabi or "noben")
