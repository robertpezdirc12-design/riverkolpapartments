#!/usr/bin/env python3
# Ali je efekt sploh slišen? Meri trenutno glasnost (M, okno 400 ms) učinske
# podlage v oknu vsake postavitve in jo primerja z mergeno podlago v istem času.
#
# Dva razloga, da je ta mera potrebna — in dva, da prejšnja števila niso:
#  * Integrirana LUFS se zaradi kitel premakne za 0,01 LU, torej mera celotnega
#    posnetka učinkov ne vidi in ne more biti pogoj kakovosti.
#  * ebur128 poroča na mreži 0,1 s in tišino označi kot −164,1. Vzročiti
#    najbližjo točko pomeni, da padec pred napadom ali sama tišina postane
#    "meritev": udarec je kazal −146 dB, numpy pa −24 dBFS. Zato zdaj beremo
#    maksimum po oknu, podlago pa vzamemo ob tem maksimumu.
#
#   raba: python rka-efekti-mera.py 60 sl [--podlaga=<master>]
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json, os, re, subprocess, sys

SPLAT = r"C:\Users\admin\Downloads\sssdf\rka-onepage"
SCRATCH = os.path.join(os.environ["TEMP"], "rka-zvok")
FFMPEG = r"C:\Users\admin\.qoder\bin\ffmpeg.exe"
VRSTICA = re.compile(r"t:\s*([\d.]+)\s+.*?M:\s*(-?[\d.]+|-inf)")

# Koliko sme vsak tip efekta ostati pod mergeno podlago (LUFS). Pragovi so
# odločitev, ne mera: šumenje na rezu sme ostati pod govorom, udarec na glavah
# pa mora biti dogodek, sicer ne plača nič.
PRAG = {"kitla": -12.0, "kitla_pod_govorom": -18.0, "udarec": -4.0,
        "udarec_pod_govorom": -10.0, "dvig": -16.0, "dvig_pod_govorom": -20.0}


def trenutki(pot):
    """[(t, M)] iz verbose dnevnika ebur128; tišina (−164,1) ostane, je pa resnična."""
    r = subprocess.run([FFMPEG, "-hide_banner", "-nostdin", "-loglevel", "verbose", "-i", pot,
                        "-af", "ebur128=framelog=verbose", "-f", "null", os.devnull],
                       stdin=subprocess.DEVNULL, capture_output=True, timeout=600)
    izhod = r.stderr.decode("utf-8", "replace")
    tocke = [(float(m.group(1)), float(m.group(2))) for m in VRSTICA.finditer(izhod)]
    if not tocke:
        raise SystemExit(f"NI VERBOZNEGA DNEVNIKA ebur128 za {pot}:\n" + izhod[-400:])
    return tocke


def naj(tocke, t):
    """M podlage pri ze izbranem casu ucinka."""
    return min(tocke, key=lambda x: abs(x[0] - t))[1]


def maksimum(tocke, zacetek, konec):
    """(cas vrha, vrh M) po oknu; robova vzorca sta vkljucena, da 400 ms okno
    pokrije ves efekt, ne samo njegovega napada."""
    okno = [(t, m) for t, m in tocke if zacetek - 0.05 <= t <= konec + 0.05]
    if not okno:
        return None
    return max(okno, key=lambda x: x[1])


def meri(efekti, seznam, podlaga):
    with open(seznam, encoding="utf-8") as f:
        e = json.load(f)
    m_ef = trenutki(efekti)
    m_pd = trenutki(podlaga)
    vrstice = []
    for p in e["postavitve"]:
        v = maksimum(m_ef, p["zac"], p["zac"] + p["trajanje"])
        if v is None:
            vrstice.append((p, None, None, None, "NI OKNA"))
            continue
        t_vrh, m_ef_vrh = v
        m_pd_vrh = naj(m_pd, t_vrh)
        vrstice.append((p, m_ef_vrh, m_pd_vrh, m_ef_vrh - m_pd_vrh, ""))
    return e, vrstice


def main():
    rez = sys.argv[1] if len(sys.argv) > 1 else "60"
    jezik = sys.argv[2] if len(sys.argv) > 2 else "sl"
    podlaga = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--podlaga=")),
                   os.path.join(SPLAT, "zvok", f"master-{rez}-{jezik}-splet.m4a"))
    efekti = os.path.join(SCRATCH, f"efekti-{rez}-{jezik}.wav")
    seznam = os.path.join(SCRATCH, f"efekti-{rez}-{jezik}.json")
    for p in (podlaga, efekti, seznam):
        if not os.path.exists(p):
            raise SystemExit(f"NEDOSTAJA {p}")
    e, vrstice = meri(efekti, seznam, podlaga)
    print(f"podlaga: {os.path.basename(podlaga)}   ucinke: {os.path.basename(efekti)}")
    print(f"{'cas':>7}  {'kader':<5} {'vrsta':<19} {'M uc.':>7} {'M podl.':>8} "
          f"{'razlika':>8} {'prag':>6}")
    slabi, premalo = [], []
    for p, m_e, m_p, r, napaka in vrstice:
        oznaka = p["vrsta"] + (" p.g." if p.get("pod_govorom") else "")
        if napaka:
            print(f"{p['zac']:7.2f}  {p['kader']:<5} {oznaka:<19} {napaka}")
            slabi.append(p["kader"])
            continue
        prag = PRAG[f"{p['vrsta']}_pod_govorom"] if p.get("pod_govorom") else PRAG[p["vrsta"]]
        if r < prag:
            slabi.append(p["kader"])
        premalo.append(max(0.0, prag - r))
        print(f"{p['zac']:7.2f}  {p['kader']:<5} {oznaka:<19} {m_e:7.1f} {m_p:8.1f} "
              f"{r:+8.1f} {prag:6.1f}{'  SLABO' if r < prag else ''}")
    padci = [r for _, _, _, r, n in vrstice if n == "" and r is not None]
    print(f"\nucinkov izmerjenih: {len(padci)}  povprecna razlika "
          f"{sum(padci)/len(padci):+.1f} dB  najglasnejsi {max(padci):+.1f}  "
          f"najtisji {min(padci):+.1f}")
    if slabi:
        print(f"SLABO: {len(slabi)} od {len(vrstice)} pod pragom -> "
              + ", ".join(slabi))
        print(f"globalen dvig ucinkov, da vsak doseze svoj prag: "
              f"+{max(premalo):.1f} dB (povprecno manjka "
              f"{sum(premalo)/len(premalo):.1f} dB)")
        raise SystemExit(1)
    print("V REDU: vsak efekt doseze svoj prag slisljivosti na mergeni podlagi.")


if __name__ == "__main__":
    main()
