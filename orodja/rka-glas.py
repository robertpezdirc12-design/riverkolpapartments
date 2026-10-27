#!/usr/bin/env python3
# Sinteza pripovedi iz časovnega lista in konformacija kadrov (rez :60 in :30).
#
# Zaporedni model Piper naložimo ENKRAT in sintezo izvedemo prek APIja.
# Razlog za API: stikalo CLI --sentence-silence ne doda tišine samo med stavke,
# ampak tudi za vsak z vejico ločen del, zato je izmerjena dolžina vrstice narasla
# z 2,2 s na 5,7 s. Pravo tišino med vrsticami ureja poznejši mik z lokacijo namreča.
#
#   1. ena vrstica pripovedi = en kader; izmeri se njeno trajanje,
#   2. kader se podaljša ali skrajša tako, da pripoved teče za sliko,
#   3. vsota oken mora ostati točno TV enota (60,0 ali 30,0 s).
#
# spot.json ostane edini vir resnice: konformacija piše okna nazanj.
# Izpisi so brez šumnikov, ker Windows konzola (cp1250) ob njih eksplodira.
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json, os, subprocess, sys, wave

SPLAT = r"C:\Users\admin\Downloads\sssdf\rka-onepage"
LIST = os.path.join(SPLAT, "spot.json")
GLASI = os.path.join(os.environ["TEMP"], "piper-glasovi")
ZVOK = os.path.join(SPLAT, "zvok")
FFMPEG = r"C:\Users\admin\.qoder\bin\ffmpeg.exe"
ZRAK = 0.30          # minimalni zračni predvstek med pripovedjo in rezom

UPORABA = """rka-glas.py <rez> <jezik> [--konformiraj]
  rez: 60 | 30       jezik: sl | en
  --konformiraj    prestecek casa razdeli na okna kadrov in zapise v spot.json
  --raister=0.95   Piper length-scale (< 1 = hitrejsi govor)
  --glas=<ime>     prepise model iz spot.json
  --sirina-suma=0  Piper noise_w_scale (0 = dolocljiv ritem, ponovljiva sinteza)"""


class Glas:
    """En model v spominsk: naloži se enkrat, nato sintetizira vse vrstice."""

    def __init__(self, onnx, rajster, sirina_suma=0.0):
        from piper import PiperVoice
        from piper.config import SynthesisConfig
        self.sr = None
        self.vozilo = PiperVoice.load(onnx)
        # noise_w_scale je sum nad dolzino fonemov: nicel = casovno dolocljiva sinteza,
        # brez njega kegelj vsakic narase ali se skrci, izmera pa ne sme uhajati.
        self.nastavitev = SynthesisConfig(length_scale=rajster, noise_w_scale=sirina_suma)
        self.sr = self.vozilo.config.sample_rate

    def posnamej(self, besedilo, pot):
        st = 0
        with wave.open(pot, "wb") as z:
            z.setnchannels(1)
            z.setsampwidth(2)
            z.setframerate(self.sr)
            for kos in self.vozilo.synthesize(besedilo, syn_config=self.nastavitev):
                z.writeframes(kos.audio_int16_bytes)
                st += len(kos.audio_int16_bytes) // 2
        if st == 0:
            raise SystemExit(f"NAPAKA: prazna sinteza za '{besedilo}'")
        return round(st / self.sr, 3)


def predelaj(pot, izhodni_vzorec):
    """22,05 kHz → 48 kHz mono 16-bit, kot to zahteva TV distribucija."""
    r = subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", pot,
                        "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", pot + ".48.wav"],
                       capture_output=True)
    if r.returncode != 0:
        raise SystemExit("NAPAKA PRI PRETVORBI: " + r.stderr.decode("utf-8", "replace")[-400:])
    os.replace(pot + ".48.wav", pot)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    zastavke = [a for a in sys.argv[1:] if a.startswith("--")]
    if any(a in ("-h", "--help") for a in sys.argv) or len(args) < 2:
        print(UPORABA)
        return
    rez, jezik = args[0], args[1]
    if rez not in ("60", "30") or jezik not in ("sl", "en"):
        raise SystemExit("NAPAKA: rez mora biti 60 ali 30, jezik sl ali en.")
    konformiraj = "--konformiraj" in zastavke
    rajster = next((float(a.split("=")[1]) for a in zastavke if a.startswith("--raister")), 1.0)
    sirina_suma = next((float(a.split("=")[1]) for a in zastavke
                        if a.startswith("--sirina-suma")), 0.0)

    with open(LIST, encoding="utf-8") as f:
        m = json.load(f)
    napisi = m["rezi"][rez]
    enota = napisi["dolzina"]
    sklad = {k["id"]: k for k in m["kadri"]}
    kljuc_prepis = f"govor{'Sl' if jezik == 'sl' else 'En'}{rez}"
    prepisi = napisi.get(kljuc_prepis, {})
    glas_imen = next((a.split("=")[1] for a in zastavke if a.startswith("--glas=")),
                     m["zvok"]["pripoved_sl" if jezik == "sl" else "pripoved_en"]["glas"])
    onnx = os.path.join(GLASI, glas_imen + ".onnx")
    if not os.path.exists(onnx):
        raise SystemExit(f"NEDOSTAJA MODEL {onnx}\n  python -m piper.download_voices {glas_imen} --download-dir {GLASI}")

    mapa = os.path.join(ZVOK, f"{rez}-{jezik}")
    os.makedirs(mapa, exist_ok=True)
    print(f"rez :{rez} ({napisi['naslov']})  enota={enota}s  glas={glas_imen}  raister={rajster}  sirina-suma={sirina_suma}")
    gov = Glas(onnx, rajster, sirina_suma)
    print(f"  model naložen, vzorec {gov.sr} Hz")

    vrstica, govor_skupaj, najmanjsa = [], 0.0, 0.0
    for kad_id, okno in napisi["niz"]:
        k = sklad[kad_id]
        besedilo = prepisi.get(kad_id, k["govorSl" if jezik == "sl" else "govorEn"])
        dat = os.path.join(mapa, kad_id + ".wav")
        t = gov.posnamej(besedilo, dat)
        predelaj(dat, gov.sr)
        rob = round(okno - ZRAK - t, 2)
        vrstica.append({"kader": kad_id, "okno": okno, "govor": t, "rob": rob,
                        "besedilo": besedilo, "datoteka": f"zvok/{rez}-{jezik}/{kad_id}.wav"})
        govor_skupaj += t
        najmanjsa += t + ZRAK
        print(f"  {kad_id}  okno={okno:4.2f}s  govor={t:5.2f}s  rob={rob:+5.2f}s"
              + ("" if rob >= 0 else "   !! pripoved ne tece za sliko"))

    zasedenost = 100 * govor_skupaj / enota
    print(f"\n  pripoved skupaj {govor_skupaj:.2f}s v enoti {enota:.1f}s ({zasedenost:.0f}% zasedenosti)")
    print(f"  najkrajso mozna dolzina tega reza: {najmanjsa:.2f}s")
    if zasedenost > 78:
        print("  SVET: nad ~78% zasedenosti pripoved deluje kot informativni oglas, ne kot reklama.")

    if konformiraj:
        if najmanjsa > enota + 0.001:
            print(f"\n  KONFORMACIJA NI MOGOCA: manjka {najmanjsa - enota:.2f}s.")
            return
        nova = [[v["kader"], round(v["govor"] + ZRAK, 2)] for v in vrstica]
        zrak = round(enota - sum(o for _, o in nova), 2)
        if zrak > 0:
            utezi = [v["govor"] + ZRAK for v in vrstica]
            vsota = sum(utezi)
            nova = [[c, round(o + zrak * u / vsota, 2)] for (c, o), u in zip(nova, utezi)]
            poravnava = round(enota - sum(o for _, o in nova), 2)
            nova[-1][1] = round(nova[-1][1] + poravnava, 2)
        else:
            poravnava = 0.0
        napisi["niz"] = nova
        for v, (_, okno) in zip(vrstica, nova):
            v["okno"], v["rob"] = okno, round(okno - ZRAK - v["govor"], 2)
        with open(LIST, "w", encoding="utf-8") as f:
            json.dump(m, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"  KONFORMIRANO: zrak {zrak:.2f}s razdeljen po utezi, "
              f"vsota={sum(o for _, o in nova):.2f}s (zaokrozitev {poravnava:+.2f}s na {nova[-1][0]}).")
        print("  spot.json zapisan.")

    pot_seznama = os.path.join(mapa, "seznam.json")
    with open(pot_seznama, "w", encoding="utf-8") as f:
        json.dump({"rez": rez, "jezik": jezik, "glas": glas_imen, "raister": rajster,
                   "enota": enota, "zasedenost": round(zasedenost, 1),
                   "govor_skupaj": round(govor_skupaj, 2), "linie": vrstica},
                  f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"  seznam: {pot_seznama}")


if __name__ == "__main__":
    main()
