# PREDANI master proti današnjemu okvirju: se je platno premaknilo?
#
# rka-izvoz-okvir.cjs izriše okvir, ki bi ga izvoznik izdal DANES; ta skript iz
# iste ure izlušči okvir IZ PREDANE datoteke in poišče navpični zamik, ki
# minimizira absolutno razliko spodnjega pasu. Nič ne temelji na aritmetiki CSS:
# trditev "izvoznik vidi zamrznjeno platno" sme soditi samo primerjava slik.
#
# Zamik iščemo po celih pikselih; dovoljeni odklon je 1 px, ker h264 (crf 17) rob
# beznega besedila zabriše za en piksel.
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import subprocess, sys, os
from PIL import Image
import numpy as np

T = os.environ["TEMP"]
FF = r"C:\Users\admin\.qoder\bin\ffmpeg.exe"
SRICJE = 30
# (ime, današnji PNG, predani master, ure [s] za vsak shranjen okvir)
PRIMERI = [
    ("pokonci", "rka-izvoz-pokonci-60sl-{i}.png",
     r"C:\Users\admin\Downloads\sssdf\rka-reklama\rka-60-sl-druzbeno-pokonci.mp4",
     [0.6, 28.2, 55.2]),
    ("leznik", "rka-izvoz-leznik-60sl-{i}.png",
     r"C:\Users\admin\Downloads\sssdf\rka-reklama\rka-60-sl-druzbeno.mp4",
     [0.6, 28.2, 55.2]),
]
# Pas zajame spodnjih 400 px platna — dovolj visok, da ujame premik navzgor in
# navzdol.
PAS = 400


def izlusci(master, t, izhod):
    n = int(round(t * SRICJE))
    r = subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", "-i", master,
                        "-vf", f"select=eq(n\\,{n})", "-frames:v", "1", izhod],
                       capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(izhod):
        raise SystemExit(f"ffmpeg ni izluščil okvirja {n} iz {master}: {r.stderr[-300:]}")


def nizkost(pot):
    a = np.asarray(Image.open(pot).convert("L"), dtype=np.int16)
    return a


def sled_od_dna(slika):
    """Spodnja vrsta s svetlim besedilom v pasu (merjeno relativno na pas, da
    temno ozadje ne laže). Vrne -1, če pas nima besedila."""
    pas = slika[-PAS:, :]
    vrh = pas.max(axis=1)
    prag = pas.max() * 0.55
    kjer = np.nonzero(vrh > prag)[0]
    return (len(vrh) - 1 - kjer[-1]) if len(kjer) else -1


print(f"{'primer':<9} {'ura':>6}  {'sled danes':>11} {'sled master':>12} {'zamik px':>9} {'ostanek razlike':>16}")
slabi = []
for ime, vzorec, master, uri in PRIMERI:
    for i, t in enumerate(uri):
        danes = os.path.join(T, vzorec.format(i=i))
        if not os.path.exists(danes):
            raise SystemExit(f"današnji okvir manjka: {danes}")
        izhod = os.path.join(T, f"rka-master-{ime}-{i}.png")
        izlusci(master, t, izhod)
        a, b = nizkost(danes), nizkost(izhod)
        if a.shape != b.shape:
            raise SystemExit(f"okvirja se ne ujemata po meri: {a.shape} vs {b.shape} ({ime} t={t})")
        pas_a, pas_b = a[-PAS:, :], b[-PAS:, :]
        best, bestv = None, None
        for dy in range(-80, 81):
            if dy < 0:
                x = pas_a[0:PAS + dy, :] - pas_b[-dy:PAS, :]
            elif dy > 0:
                x = pas_a[dy:, :] - pas_b[0:PAS - dy, :]
            else:
                x = pas_a - pas_b
            if x.size == 0:
                continue
            m = float(np.abs(x).mean())
            if bestv is None or m < bestv:
                bestv, best = m, dy
        dna, dnb = sled_od_dna(a), sled_od_dna(b)
        zamik = dna - dnb if dna >= 0 and dnb >= 0 else None
        print(f"{ime:<9} {t:>6.1f}  {str(dna):>11} {str(dnb):>12} {str(zamik):>9} {bestv:>16.2f}")
        if best is None or abs(best) > 1:
            slabi.append(f"{ime} t={t}: platno se je premaknilo za {best} px "
                         f"(ostanek razlike {bestv:.2f})")
        elif zamik is not None and abs(zamik) > 2:
            slabi.append(f"{ime} t={t}: sled beznega besedila se razlikuje "
                         f"({dna} px proti {dnb} px)")

print()
if slabi:
    print("NI V REDU:")
    for s in slabi:
        print("  " + s)
    sys.exit(1)
print("V REDU: vsak primerjani okvir se s predanim masterjem ujame v 1 px.")
