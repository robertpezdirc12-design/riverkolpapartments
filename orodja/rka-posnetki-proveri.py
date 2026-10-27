#!/usr/bin/env python3
"""Posnetek platna ni dokler ni dokazano, da je na njem SLIKA, ne le besedilo.

Prejšnji trije zagoni orodja rka-posnetki.cjs so izdali "V REDU" in črna platna
v enoti :60: DOM je pravilno trdil, da je slika dekodirana in da je kader na
sredini, slikovni layer pa se v headless instanci ni preslikal (predvajajoč
<video> brez GPU). Posnetek zato preverjamo po svetlosti pasu, kjer ne sme biti
napisa — sicer orodje, ki samo sebi verjame, spet poroča laž.

raba: python rka-posnetki-proveri.py [mapa]
"""
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")

MAPA = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\admin\AppData\Local\Temp\rka-shot-kadri"
# Corpus sme napisati samo rka-posnetki-izvozi.cjs, ki kadre izreže iz DOSTAVLJENIH
# MP4. 25. 10. je mapa rka-shot vsebovala še zaslone iz časa pred popravkom črnega
# platna in je zato javila tri črne kadre, ki v datotekah niso črni.
# Izmerjeni razpon: črno platno samo z besedilom = pas 13,5 in vrh 18,0;
# pravi kadri = pas 76..146 in vrh 190..252. Meji stojita med izmerjenima
# svetovoma, ne ugibanju.
STROPA_PAS = 25.0
STROPA_VRH = 60.0
napake = []

MERJENI = 0
for ime in sorted(os.listdir(MAPA)):
    if not ime.startswith("rka-") or not ime.endswith(".png"):
        continue
    MERJENI += 1
    slika = Image.open(os.path.join(MAPA, ime)).convert("L")
    w, h = slika.size
    pas = slika.crop((int(w * 0.10), int(h * 0.06), int(w * 0.90), int(h * 0.45)))
    tock = sorted(pas.tobytes())
    rep = int(len(tock) * 0.02)
    povprecje = sum(tock) / len(tock)
    vrh = sum(tock[-rep:]) / rep
    slovo = "OK" if povprecje >= STROPA_PAS and vrh >= STROPA_VRH else "ČRNO"
    if povprecje < STROPA_PAS:
        napake.append(f"{ime}: pas je povprečno {povprecje:.1f} — pod {STROPA_PAS}, "
                      f"na platnu ni slike")
    elif vrh < STROPA_VRH:
        napake.append(f"{ime}: najsvetlejših 2 % pasu meri {vrh:.1f} — pod {STROPA_VRH}, "
                      f"na pasu ni ničesar svetlejšega od črnine")
    print(f"  {ime:32} {w}x{h}  pas={povprecje:6.1f}  vrh={vrh:6.1f}  {slovo}")

if MERJENI == 0:
    print(f"Ni nobene datoteke v '{MAPA}' — vrata ne merijo ničesar in ne smejo "
          f"trditi, da so V REDU.")
    sys.exit(1)
if napake:
    print("NESKLADJE:")
    for n in napake:
        print("  -", n)
    sys.exit(1)
print(f"V REDU: {MERJENI} posnetkov, vsak ima svetlo slikovno podlago, ne samo besedila.")
