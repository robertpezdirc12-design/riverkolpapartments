# Zmeri, kaj glasbeni sloj dejansko naredi: razliko med posnetkom z glasbo in
# brez nje na dveh krajih casovnice.
#
# raba: python rka-razlika.py <stari_mojster> <novi_mojster> <zapis_namer>
#
# Kraj A je najsirsa vrzel med vrsticami (tam mora glasba stopiti v veljavo,
# sicer je podlaga odrecna). Kraj B je sredi najbolj zgoscene pripovedi (tam
# sme glasba uhajati najvec +3 dB, sicer beseda ni razumljiva).
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json
import os
import subprocess
import sys

FFMPEG = r"C:\Users\admin\.qoder\bin\ffmpeg.exe"


def lufs(pot, zacetek, dolzina):
    # brez -loglevel error: loudnormov JSON-povzetek se izpise samo na ravni info
    r = subprocess.run(
        [FFMPEG, "-hide_banner", "-nostdin", "-nostats",
         "-ss", f"{zacetek:.3f}", "-t", f"{dolzina:.3f}", "-i", pot,
         "-af", "loudnorm=I=-23:TP=-1.5:print_format=json", "-f", "null", "-"],
        capture_output=True, text=True, check=True)
    besedilo = r.stderr
    if "{" not in besedilo:
        raise SystemExit(f"NI MERITVE za {pot} od {zacetek}s")
    za = besedilo.find("{")
    m = json.loads(besedilo[za:besedilo.rfind("}") + 1])
    return float(m["input_i"])


def prozori(zapis):
    with open(zapis, encoding="utf-8") as f:
        z = json.load(f)
    enota = z["enota"]
    v = z["vrstice"]
    vrzeli = []
    for a, b in zip(v, v[1:]):
        vrzeli.append((b["zac"] - a["konec"], a["konec"], b["zac"]))
    vrzeli.sort(reverse=True)
    najsirsa = vrzeli[0]
    okno_a = round(najsirsa[1] + (najsirsa[0] - 3.0) / 2, 3)
    okno_a = max(0.0, min(okno_a, enota - 3.1))
    # Zgošcenje: vrzel, kjer konec jedne vrstice sovpada z zacetkom druge.
    tesna = min(vrzeli[1:], key=lambda x: x[0]) if len(vrzeli) > 1 else vrzeli[0]
    okno_b = round((tesna[1] + tesna[2]) / 2 - 1.5, 3)
    okno_b = max(0.0, min(okno_b, enota - 3.1))
    return okno_a, okno_b, najsirsa[0], tesna[0]


stari, novi, zapis = sys.argv[1:4]
a, b, siroka, tesna = prozori(zapis)
print(f"najsiroja vrzel {siroka:.2f} s, tesna {tesna:.2f} s")
for ime, okno in (("A vrzel", a), ("B pod govorom", b)):
    x, y = lufs(stari, okno, 3.0), lufs(novi, okno, 3.0)
    print(f"  {ime:<16} od {okno:5.2f}s  brez glasbe {x:6.1f} LUFS  "
          f"z glasbo {y:6.1f} LUFS  razlika {y - x:+5.1f} dB")
