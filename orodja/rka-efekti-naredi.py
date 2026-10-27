#!/usr/bin/env python3
# Zvočni efekti spota: kitla na reze, udarec na glavah poglavij in dvig pred
# zaključno kartico.
#
# Zakaj sinteticno in ne iz banke zvokov: efekti morajo stati točno na reznih
# tockah, ki jih ze meri casovni list, in morajo biti licencno cisti — reklama je
# komercialni izdelek. Generiran signal nima licencne odprtine in je v celoti
# ponovljiv (isti seznam → isti bajti).
#
#   raba: python rka-efekti-naredi.py [60|30] [sl|en] [--dvi=+8]
#
# Pise v Temp/rka-zvok: efekte so vhod miksa (rka-zvok.py --efekti=), ne izdelek,
# zato ne pridejo v maps stranke.
#
# Hierarhija je zavestna: sredina nima nobenega efekta (podlaga reke tam diha),
# menjava same slike dobi kitlo, menjava poglavja dobi udarec. Ce bi vsak rez
# dobil udarec, se udarec ne bi nic placal.
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json, os, subprocess, sys, wave
import numpy as np

SPLAT = r"C:\Users\admin\Downloads\sssdf\rka-onepage"
SCRATCH = os.path.join(os.environ["TEMP"], "rka-zvok")
FFMPEG = r"C:\Users\admin\.qoder\bin\ffmpeg.exe"
SR = 48000

KITLA_TRAJANJE = 0.52   # 0,30 s pred rezom (dvig) + 0,22 s repa cez zabris
KITLA_PRED = 0.30       # kitla se zacne tolko PREJ kot rez: zvok napove sliko
DVIG_UTRIP = 4          # koliko utripov pred zakljucko kartico se dvigne
UDAREC_TRAJANJE = 0.60

GLASNOST = {"kitla": -22.0, "kitla_pod_govorom": -28.0,
            "udarec": -18.0, "udarec_pod_govorom": -24.0,
            "dvig": -26.0, "dvig_pod_govorom": -32.0}


def pas(n, lo, hi, rng, rob=0.12):
    """Rovski sum, omejen na pas. Rob je dvižni kosinus v log-f, da rob ne zvoni."""
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1.0 / SR)
    center = 0.5 * (lo + hi)
    half = 0.5 * np.log(hi / lo)
    u = np.clip(np.abs(np.log(np.maximum(f, 1.0) / center)) / (half + rob), 0, None)
    mask = np.where(u <= 1.0, 0.5 * (1 + np.cos(np.pi * np.minimum(u, 1.0))), 0.0)
    y = np.fft.irfft(X * mask, n)
    vrh = np.max(np.abs(y))
    return y / vrh if vrh > 0 else y


def napravi(pot_db, x):
    vrh = np.max(np.abs(x))
    return x * (10.0 ** (pot_db / 20.0)) / vrh if vrh > 0 else x


def kitla(rng, trajanje=KITLA_TRAJANJE):
    """Trije pasovi se premikajo navzgor skozi cas: energija zivi, ne ponavlja se."""
    n = int(trajanje * SR)
    t = np.arange(n) / SR
    u = t / trajanje
    c, si = np.array([0.16, 0.46, 0.74]), 0.20
    plosca = np.zeros(n)
    for i, (lo, hi) in enumerate([(180.0, 560.0), (560.0, 1900.0), (1900.0, 6200.0)]):
        z = np.exp(-((u - c[i]) / si) ** 2)
        plosca += z * pas(n, lo, hi, rng) * (0.55 if i else 0.75)
    R = KITLA_PRED / trajanje
    ovojnica = np.where(u < R, (u / R) ** 1.25, np.clip(1 - (u - R) / (1 - R), 0, None) ** 1.7)
    x = plosca * ovojnica
    # konstantna moc: pan gre od -0,55 (levo) do +0,55 (desno) cez dvig
    pan = -0.55 + 1.10 * np.clip(u / R, 0, 1)
    g_l = np.sqrt((1 - pan) / 2)
    g_r = np.sqrt((1 + pan) / 2)
    return np.stack([x * g_l, x * g_r], axis=1)


def udarec(rng, trajanje=UDAREC_TRAJANJE):
    n = int(trajanje * SR)
    t = np.arange(n) / SR
    f = 44.0 + (92.0 - 44.0) * np.exp(-t / 0.055)
    telo = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    klik = pas(n, 1400, 7000, rng) * np.exp(-t / 0.008) * 0.5
    grmenje = pas(n, 32, 130, rng) * np.exp(-t / 0.30) * 0.55
    return np.stack([telo + klik + grmenje] * 2, axis=1)


def dvig(rng, trajanje):
    n = int(trajanje * SR)
    t = np.arange(n) / SR
    u = t / trajanje
    e = u ** 2.4
    plosca = ((1 - u) ** 2 * pas(n, 200, 700, rng) * 0.4
              + np.sin(np.pi * u) ** 2 * pas(n, 700, 2100, rng) * 0.5
              + u ** 2 * pas(n, 2100, 6400, rng) * 0.6)
    ton = np.sin(2 * np.pi * np.cumsum(160.0 + (430.0 - 160.0) * u ** 1.6) / SR) * e * 0.28
    x = (plosca + ton) * e
    x[-int(0.012 * SR):] *= np.linspace(1, 0, int(0.012 * SR))   # rok brez poka
    return np.stack([x] * 2, axis=1)


def lufs(pot):
    r = subprocess.run([FFMPEG, "-hide_banner", "-nostdin", "-nostats", "-i", pot, "-af",
                        "ebur128=framelog=quiet", "-f", "null", os.devnull],
                       stdin=subprocess.DEVNULL, capture_output=True, timeout=300)
    vr = r.stderr.decode("utf-8", "replace").splitlines()
    for i, l in enumerate(vr):
        if l.strip().startswith("I:") and "Summary" in "".join(vr[max(0, i - 3):i]):
            return l.strip()
    for l in reversed(vr):
        if l.strip().startswith("I:"):
            return l.strip()
    return "ni meritve"


def pod_govorom(zac, konec, vrstice):
    return any(zac < v["konec"] and konec > v["zac"] for v in vrstice)


def naredi(rez, jezik):
    with open(os.path.join(SPLAT, "spot.json"), encoding="utf-8") as f:
        m = json.load(f)
    with open(os.path.join(SPLAT, "zvok", f"namera-{rez}-{jezik}.json"), encoding="utf-8") as f:
        lista = json.load(f)
    r = m["rezi"][rez]
    enota = r["dolzina"]
    kadri = {k["id"]: k for k in m["kadri"]}
    utrip = 60.0 / r["bit"]["bpm"] if r.get("bit") else 0.5
    n = int(round(enota * SR))
    platno = np.zeros((n, 2))
    postavljeni = []

    # cumulative start times
    t = 0.0
    tocke = []
    for kid, w in r["niz"]:
        tocke.append((kid, round(t, 5)))
        t += w
    zadnji = tocke[-1][1]

    for i, (kid, z) in enumerate(tocke):
        if i == 0:
            continue                       # t=0 je crn začetek; kitla tam pomeni napako
        nova_poglavje = kadri[kid]["pog"] != kadri[tocke[i - 1][0]]["pog"]
        if z - KITLA_PRED <= 0:
            continue
        rng = np.random.default_rng(1000 + i)
        # Zakljucna kartica dobi udarec, ne kitle: dvig se mora nekam pripeljati,
        # sicer se konca v tisini in efekt izgine ravno tam, kjer sme biti
        # najglasnejši.
        if nova_poglavje or kid == "k22":
            pod = pod_govorom(z, z + UDAREC_TRAJANJE, lista["vrstice"])
            x = napravi(GLASNOST["udarec_pod_govorom"] if pod else GLASNOST["udarec"],
                        udarec(rng))
            zac, ime = z, "udarec"
        else:
            pod = pod_govorom(z - KITLA_PRED, z + 0.22, lista["vrstice"])
            x = napravi(GLASNOST["kitla_pod_govorom"] if pod else GLASNOST["kitla"],
                        kitla(rng))
            zac, ime = z - KITLA_PRED, "kitla"
        a = int(round(zac * SR))
        b = min(n, a + x.shape[0])
        if a < 0 or b <= a:
            continue
        platno[a:b] += x[:b - a]
        postavljeni.append({"kader": kid, "vrsta": ime, "zac": round(zac, 4),
                            "rez": round(z, 4), "trajanje": round(x.shape[0] / SR, 4),
                            "pod_govorom": bool(pod)})

    if utrip:
        rng = np.random.default_rng(7)
        pod = pod_govorom(zadnji - DVIG_UTRIP * utrip, zadnji, lista["vrstice"])
        x = napravi(GLASNOST["dvig_pod_govorom"] if pod else GLASNOST["dvig"],
                    dvig(rng, DVIG_UTRIP * utrip))
        a = int(round((zadnji - DVIG_UTRIP * utrip) * SR))
        b = min(n, a + x.shape[0])
        platno[a:b] += x[:b - a]
        postavljeni.append({"kader": tocke[-1][0], "vrsta": "dvig",
                            "zac": round(a / SR, 4), "rez": round(zadnji, 4),
                            "trajanje": round(x.shape[0] / SR, 4),
                            "pod_govorom": bool(pod)})

    vrh = float(np.max(np.abs(platno)))
    if vrh > 10 ** (-1.0 / 20.0):          # ni preklapanja: skala se dol, vedno
        faktor = 10 ** (-1.0 / 20.0) / vrh
        platno *= faktor
        for p in postavljeni:
            p["prilagodeno"] = round(faktor, 4)
        vrh *= faktor
    pot = os.path.join(SCRATCH, f"efekti-{rez}-{jezik}.wav")
    os.makedirs(SCRATCH, exist_ok=True)
    hrbt = np.clip(np.round(platno * 32767.0), -32768, 32767).astype("<i2")
    with wave.open(pot, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(hrbt.tobytes())
    with open(os.path.join(SCRATCH, f"efekti-{rez}-{jezik}.json"), "w", encoding="utf-8") as f:
        json.dump({"rez": rez, "jezik": jezik, "enota": enota, "vrh_dbfs": round(20 * np.log10(vrh), 2),
                   "glasnosti": GLASNOST, "postavitve": postavljeni}, f, ensure_ascii=False, indent=1)
    stevila = {}
    for p in postavljeni:
        stevila[p["vrsta"]] = stevila.get(p["vrsta"], 0) + 1
    print(f":{rez} {jezik}  {len(postavljeni)} efektov "
          f"({', '.join(f'{k}:{v}' for k, v in sorted(stevila.items()))})  "
          f"vrh {20*np.log10(vrh):.2f} dBFS  {lufs(pot)}")
    print(f"  -> {pot}")
    return pot


if __name__ == "__main__":
    pari = [(a, b) for a in ("60", "30") for b in ("sl", "en")]
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if args:
        pari = [(args[0], args[1] if len(args) > 1 else "sl")]
    # --dvi=+N prestavi ves stolpec hkrati: hierarhija (kitla < udarec,
    # pod govorom -6 dB) ostane, spreminja se samo razdalja do podlage.
    # Brez tega gumba bi moral za vsak poskus urejati šest stevil.
    for g in [a.split("=", 1) for a in sys.argv[1:] if a.startswith("--dvi=")]:
        odstop = float(g[1].replace("+", ""))
        for k in GLASNOST:
            GLASNOST[k] += odstop
    for rez, jezik in pari:
        naredi(rez, jezik)
