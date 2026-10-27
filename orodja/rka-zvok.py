#!/usr/bin/env python3
# Zvok spota: pripoved + zvočna podlaga reke z dušenjem, nato dvostopenjska
# poravnava po EBU R128.
#
#   mojster (TV)   I=-23 LUFS  TP=-1,5 dBTP
#   splet         I=-16 LUFS  TP=-1,5 dBTP
#   druzbeno       I=-14 LUFS  TP=-1,5 dBTP  (družbeni omrežni predvajalniki
#                  ostanejo pri svoji normalizaciji, zato mora master priti do
#                  njihovega praga in ne pod njega)
#
# 1. korak izmeri izhod miksa (meritev je neodvisna od cilja, zato velja za oba),
# 2. korak linearno normalizira in encode zraven zapiše ebur128 preizkus —
#    ne zaupamo filtri, zaupamo izmerjeni datoteki.
#
#   raba: python rka-zvok.py [rez jezik] [--mojster] [--glasba=<datoteka>]
#                          [--cilji=<mojster,splet,druzbeno>] [--predogled]
#
# --glasba doda tretji sloj pod pripoved; --predogled zapiše mojstre v Temp,
# da pilot ne prepše že odobrene različice v zvok/.
# --cilji izbere samo tiste namene, ki se jih res piše: delni poziv ne sme
# prepisati odobrenih mojstrov in mora pustiti njihov dokaz v časovnem listu.
#
# Namreč pripovedi se izračuna iz oken kadrov: vrstica se začne, ko se rez usede
# (35 % razpoložljivega zraka pred njo), in se vedno konča znotraj svojega kadra.
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json, os, re, subprocess, sys, time

SPLAT = r"C:\Users\admin\Downloads\sssdf\rka-onepage"
LIST = os.path.join(SPLAT, "spot.json")
ZVOK = os.path.join(SPLAT, "zvok")
SCRATCH = os.path.join(os.environ["TEMP"], "rka-zvok")
LOGI = os.path.join(SCRATCH, "logi")
FFMPEG = r"C:\Users\admin\.qoder\bin\ffmpeg.exe"
FFPROBE = os.path.expandvars(
    r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
    r"\ffmpeg-9.0.2-full_build\bin\ffprobe.exe")
if not os.path.exists(FFPROBE):
    FFPROBE = "ffprobe"
PODLAGA = os.path.join(os.environ["TEMP"], "swale.ogg")

PRED_VRSTICO = 0.35   # delež zraka pred vrstico; ostanek je rep, kjer rez diha
PODLAGA_RAVEN = 0.9   # raven reke pod pripovedjo (pred dušenjem)
GLASBA_LUFS = -20.0   # zmerjeno: podlaga tako sedi 6,4 dB pod govorom (RKA-mera)
# Dušenje: med pripovedjo je v spotu največ le ~1 s zraka, zato predolga
# sprostitev drži podlago pod pragom slušnosti. Odstop in sprostitev se
# podasta z zastavicama --glasba-lufs in --dusenje.
DUSENJE = {"razmerje": 4.0, "sprositev": 220.0, "prag": 0.08}
_PODLAGA = None       # izmerjena dolžina podlage, da zanko lahko omejimo
CILJI = {"mojster": {"I": -23.0, "TP": -1.5, "LRA": 11.0},
         "splet": {"I": -16.0, "TP": -1.5, "LRA": 11.0},
         # Družbena različica: omrežni predvajalniki normalizirajo po svoje in
         # pogosto posežejo po omejevalniku. Master, ki je že merljivo na
         # cilju, ne more pasti pod njihov prag.
         # Dva decibela višje od spleta sam miks ne more prinesti: izmerjeni
         # true peak mešanice je ze -1,41 dBTP, torej vsako ojacanje prelome
         # prag. Zato ta namen dobi izrecen omejevalnik pred meritvijo — omejevanje
         # je napisano v listu, ne pride prikrito iz filtra.
         "druzbeno": {"I": -14.0, "TP": -1.5, "LRA": 11.0, "meja": -3.0}}


def izvedi(dodatni, ime_loga, timeout=600):
    """ffmpeg brez cevi: stdin je prazen, dnevnik gre v datoteko, izhod null gre v
    NUL. Brez tega se postopek zatakne in ne vrne nicesar."""
    os.makedirs(LOGI, exist_ok=True)
    log = os.path.join(LOGI, ime_loga + ".log")
    with open(log, "wb") as f:
        try:
            p = subprocess.run([FFMPEG, "-hide_banner", "-nostdin", "-loglevel", "error", "-y"]
                               + dodatni, stdin=subprocess.DEVNULL,
                               stdout=subprocess.DEVNULL, stderr=f, timeout=timeout)
        except subprocess.TimeoutExpired:
            raise SystemExit(f"FFMPEG URAVAL (>{timeout}s): {ime_loga} — glej {log}")
    if p.returncode != 0:
        if "--rcp" in sys.argv:
            print("\n--- filtergraf ---\n" + "\n".join(dodatni) + "\n--- dnevnik ---", flush=True)
            print(open(log, encoding="utf-8", errors="replace").read()[-2000:], flush=True)
        raise SystemExit(f"FFMPEG NAPAKA ({ime_loga}, koda {p.returncode}): {log}")
    return log


def trajanje(pot):
    """Trajanje datoteke v sekundah — brez tega se 58,7 s mix sprehaja kot 60 s."""
    p = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", pot],
                       stdin=subprocess.DEVNULL, capture_output=True, timeout=120)
    if p.returncode != 0:
        raise SystemExit(f"FFPROBE NI ZMEL prebrati {pot}:\n" +
                         p.stderr.decode("utf-8", "replace")[-500:])
    return round(float(p.stdout.decode("utf-8", "replace").strip()), 3)


def dolzina_podlage():
    global _PODLAGA
    if _PODLAGA is None:
        _PODLAGA = trajanje(PODLAGA)
    return _PODLAGA


def preveri_trajanje(pot, enota, ime):
    dej = trajanje(pot)
    if abs(dej - enota) > 0.05:
        raise SystemExit(f"NAPAKA {ime}: trajanje {dej}s != enota {enota}s "
                         f"(razlika {round(dej - enota, 3)}s)")
    return dej


def izmeri_r128(pot, ime_loga, timeout=600):
    """loudnorm 1. korak -> JSON; ebur128 -> kontrolna vrstica za koncni izdelek."""
    os.makedirs(LOGI, exist_ok=True)
    t0 = time.time()
    log_ln = os.path.join(LOGI, ime_loga + "-loudnorm.log")
    with open(log_ln, "wb") as f:
        try:
            subprocess.run([FFMPEG, "-hide_banner", "-nostdin", "-nostats", "-i", pot, "-af",
                            "loudnorm=I=-23:TP=-1.5:LRA=11:print_format=json",
                            "-f", "null", os.devnull],
                           stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                           stderr=f, timeout=timeout)
        except subprocess.TimeoutExpired:
            raise SystemExit(f"MERITEV URAVALA (>{timeout}s): {pot} — glej {log_ln}")
    izhod = open(log_ln, encoding="utf-8", errors="replace").read()
    a, b = izhod.rfind("{"), izhod.rfind("}")
    if a < 0 or b < 0:
        raise SystemExit("Meritev R128 ni vracala JSON-a:\n" + izhod[-900:])
    merjeno = json.loads(izhod[a:b + 1])
    log_eb = os.path.join(LOGI, ime_loga + "-ebur128.log")
    with open(log_eb, "wb") as f:
        subprocess.run([FFMPEG, "-hide_banner", "-nostdin", "-nostats", "-i", pot, "-af",
                        "ebur128=framelog=quiet:peak=true", "-f", "null", os.devnull],
                       stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                       stderr=f, timeout=timeout)
    red = open(log_eb, encoding="utf-8", errors="replace").read().splitlines()

    def vrednost(oznaka):
        for i, l in enumerate(red):
            l = l.strip()
            if l.startswith(oznaka + ":"):
                vr = l.split(":", 1)[1].strip()
                if vr:
                    return vr
                if i + 1 < len(red):          # ebur128 lahko vrednost zlome v novo vrstico
                    return red[i + 1].strip()
        return "ni meritve"

    merjeno["kontrola_ebur128"] = "I=%s  LRA=%s  TP=%s" % (
        vrednost("I"), vrednost("LRA"), vrednost("Peak"))
    merjeno["kontrola"] = {"I": vrednost("I"), "LRA": vrednost("LRA"), "TP": vrednost("Peak")}
    merjeno["as_meitve"] = round(time.time() - t0, 1)
    return merjeno


def kadi(rez, jezik):
    """-> seznam vrstic s pozicijo namreca, izracunanih iz casovnega lista."""
    with open(LIST, encoding="utf-8") as f:
        m = json.load(f)
    seznam_pot = os.path.join(ZVOK, f"{rez}-{jezik}", "seznam.json")
    if not os.path.exists(seznam_pot):
        raise SystemExit(f"NEDOSTAJA {seznam_pot}\n  zazeni: python rka-glas.py {rez} {jezik} --konformiraj")
    with open(seznam_pot, encoding="utf-8") as f:
        seznam = json.load(f)
    napisi = m["rezi"][rez]
    enota = napisi["dolzina"]
    okna = dict(napisi["niz"])
    merjeni_govor = {l["kader"]: l for l in seznam["linie"]}
    vrstice, tekoce = [], 0.0
    for kad_id, okno in napisi["niz"]:
        linija = merjeni_govor.get(kad_id)
        if linija:
            zrak = max(0.0, okno - linija["govor"])
            zac = round(tekoce + zrak * PRED_VRSTICO, 3)
            if zac + linija["govor"] > tekoce + okno + 0.001:
                raise SystemExit(f"NAPAKA {kad_id}/{jezik}: vrstica se ne konca v kadru.")
            vrstice.append({"kader": kad_id, "zac": zac, "govor": linija["govor"],
                            "konec": round(zac + linija["govor"], 3),
                            "kader_konec": round(tekoce + okno, 3),
                            "wav": os.path.join(ZVOK, f"{rez}-{jezik}", kad_id + ".wav"),
                            "besedilo": linija["besedilo"]})
        tekoce += okno
    if round(tekoce, 2) != round(enota, 2):
        raise SystemExit(f"NAPAKA: vsota oken {tekoce:.2f}s != enota {enota}s — list ni konformiran.")
    return m, enota, vrstice


RITEM = os.path.join(os.environ["TEMP"], "rka-ritem.py")


def faza_glasbe(pot):
    """Izmeri tempo in zamik prvega utripa. Mreža se mora začeti z rezom,
    sicer glasba teče pod sliko in utrip ne pomeni nič."""
    if not os.path.exists(RITEM):
        raise SystemExit(f"NEDOSTAJA {RITEM} — brez merjenja faze rezov ne morem poravnati.")
    r = subprocess.run([sys.executable, RITEM, pot], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise SystemExit(f"MERA TEMPA NI USPELA: {(r.stderr or r.stdout).strip()[-300:]}")
    t = re.search(r"tempo ([\d.]+) BPM", r.stdout)
    z = re.search(r"zamik ([\d.-]+) s", r.stdout)
    if not (t and z):
        raise SystemExit("NI MERITVE TEMPA v izhodu: " + r.stdout.strip()[-200:])
    return float(t.group(1)), float(z.group(1))


def zmeši(rez, jezik, glasba=None, efekti=None):
    m, enota, vrstice = kadi(rez, jezik)
    os.makedirs(SCRATCH, exist_ok=True)
    miks = os.path.join(SCRATCH, f"miks-{rez}-{jezik}.wav")
    if not os.path.exists(PODLAGA):
        raise SystemExit(f"NEDOSTAJA ZVOCNA PODLAGA {PODLAGA}")
    ojacanje = None
    faza = 0.0
    if glasba:
        if not os.path.exists(glasba):
            raise SystemExit(f"NEDOSTAJA GLASBA {glasba}")
        # Glasba vste se po izmerjeni glasnosti, ne po ugibanju: datoteka se
        # zmeri in nato linearna ojacava do ciljne LUFS vrednosti.
        meritev = izmeri_r128(glasba, "glasba-vhod")
        razlika = GLASBA_LUFS - float(meritev["input_i"])
        ojacanje = 10.0 ** (razlika / 20.0)
        # Če je rez razporejen na utripe, mora tempo skladbe sovpasti z mrežo;
        # sicer reži padejo med utripe in poravnava izgine.
        bit = m["rezi"][rez].get("bit")
        tempo, faza = faza_glasbe(glasba)
        if bit:
            if abs(tempo - bit["bpm"]) > 0.02 * tempo:
                raise SystemExit(f"NESKLADJE: rez :{rez} je razporejen na {bit['bpm']} BPM, "
                                 f"skladba pa se meri na {tempo:.2f} BPM.")
            print(f":{rez} {jezik}  mreza {bit['bpm']:g} BPM se ujema s skladbo "
                  f"({tempo:.2f} BPM), prvi utrip premaknjen za {faza:.3f} s", flush=True)
        else:
            print(f":{rez} {jezik}  opozorilo: rez :{rez} nima časovnega lista utripov "
                  f"(bit) — reži ne sledijo tempu {tempo:.2f} BPM", flush=True)
        print(f":{rez} {jezik}  glasba {os.path.basename(glasba)}  "
              f"I={meritev['input_i']} LUFS  odstopanje {razlika:+.1f} dB  "
              f"ojacanje {ojacanje:.3f}", flush=True)

    # Zanka je OMEJENA: neskončen vhod (-stream_loop -1) ali neskončen člen (apad)
    # pustita ffmpeg pisat polno datoteko in nikoli zakljuciti — to je tisto
    # zastajanje, ki smo ga mislili za tezavo cevi.
    zank = int(enota // dolzina_podlage()) + 1
    vhodi = ["-stream_loop", str(zank), "-t", f"{enota}", "-i", PODLAGA]
    if glasba:
        zank_g = int((enota + faza) // trajanje(glasba)) + 1
        vhodi += ["-stream_loop", str(zank_g), "-t", f"{enota + faza + 0.1:.3f}", "-i", glasba]
    # Četrti sloj: sintetizirane kitle na reze in udarci na glavah poglavij.
    # Ne duši se pod pripovedjo, ker se itske ravni že odločajo ob postavitvi
    # (rka-efekti-naredi.py spusti efekt pod govorečo vrstico za 6 dB); duojno
    # dušenje bi zabrisalo ravno tisto, kar efekt pomeni — točko v času.
    i_ef = None
    if efekti:
        if not os.path.exists(efekti):
            raise SystemExit(f"NEDOSTAJA ZVOCNI EFEKTI {efekti} — "
                             f"naredi jih: python rka-efekti-naredi.py {rez} {jezik}")
        preveri_trajanje(efekti, enota, f"efekti :{rez} {jezik}")
        i_ef = 2 if glasba else 1
        vhodi += ["-i", efekti]
    prvi_vok = i_ef + 1 if i_ef is not None else (2 if glasba else 1)
    for j, v in enumerate(vrstice):
        vhodi += ["-i", v["wav"]]
    filtri = [f"[0:a]aresample=48000,atrim=0:{enota},asetpts=PTS-STARTPTS,"
              f"highpass=f=90,lowpass=f=11000,volume={PODLAGA_RAVEN},"
              "aformat=sample_rates=48000:channel_layouts=stereo[post]"]
    if glasba:
        # atrim se zacne pri zamiku prvega utripa, zato t=0 miksa sovpada z začetkom
        # skladbe — reži nato padajo na utrip, ne mednje.
        filtri.append(f"[1:a]aresample=48000,atrim={faza:.3f}:{faza + enota:.3f},asetpts=PTS-STARTPTS,"
                      f"highpass=f=60,lowpass=f=12000,volume={ojacanje:.4f},"
                      f"afade=t=in:st=0:d=1.2,afade=t=out:st={round(enota - 2.5, 3)}:d=2.5,"
                      "aformat=sample_rates=48000:channel_layouts=stereo[glas]")
    if efekti:
        filtri.append(f"[{i_ef}:a]aresample=48000,atrim=0:{enota},asetpts=PTS-STARTPTS,"
                      "highpass=f=32,aformat=sample_rates=48000:channel_layouts=stereo[efx]")
    oznake = []
    for i, v in enumerate(vrstice, start=prvi_vok):
        ms = int(round(v["zac"] * 1000))
        filtri.append(f"[{i}:a]aresample=48000,adelay={ms}|{ms},"
                      "aformat=sample_rates=48000:channel_layouts=stereo[go%d]" % i)
        oznake.append(f"[go{i}]")
    filtri.append("".join(oznake) +
                  f"amix=inputs={len(vrstice)}:duration=longest:normalize=0,"
                  # apad brez meje naredi neskonen vhod; whole_dur ga zakljuci na enoti,
                  # sicer se dušenje konca skupaj s pripovedjo in pojede zadnjih ~0,9 s
                  f"apad=whole_dur={enota}[vogov]")
    filtri.append("[vogov]asplit=2[sc][gl]")
    if glasba:
        filtri.append("[sc]asplit=2[sc1][sc2]")
        filtri.append("[post][sc1]sidechaincompress=threshold=0.08:ratio=8:attack=60:"
                      "release=500:makeup=1[postd]")
        filtri.append(f"[glas][sc2]sidechaincompress=threshold={DUSENJE['prag']}:"
                      f"ratio={DUSENJE['razmerje']:g}:attack=40:"
                      f"release={DUSENJE['sprositev']:.0f}:makeup=1[glasd]")
        filtri.append("".join(["[postd]", "[glasd]", "[gl]"] + (["[efx]"] if efekti else [])) +
                      f"amix=inputs={3 + bool(efekti)}:duration=longest:normalize=0,"
                      f"afade=t=in:st=0:d=0.9,afade=t=out:st={round(enota - 1.4, 3)}:d=1.4,"
                      f"atrim=0:{enota}[miks]")
    else:
        filtri.append("[post][sc]sidechaincompress=threshold=0.08:ratio=8:attack=60:"
                      "release=500:makeup=1[postd]")
        filtri.append("".join(["[postd]", "[gl]"] + (["[efx]"] if efekti else [])) +
                      f"amix=inputs={2 + bool(efekti)}:duration=longest:normalize=0,"
                      f"afade=t=in:st=0:d=0.9,afade=t=out:st={round(enota - 1.4, 3)}:d=1.4,"
                      f"atrim=0:{enota}[miks]")
    izvedi(vhodi + ["-filter_complex", ";".join(filtri), "-map", "[miks]",
                    "-t", f"{enota}", "-ac", "2", "-ar", "48000",
                    "-c:a", "pcm_s16le", miks],
           f"miks-{rez}-{jezik}", timeout=240)
    dejansko = preveri_trajanje(miks, enota, f"miks :{rez} {jezik}")
    print(f":{rez} {jezik}  mix {dejansko}s / enota {enota}s  (podlaga v {zank + 1} predvajanjih)",
          flush=True)
    return m, enota, vrstice, miks


def preveri(k, cilj):
    """Znati samo, ce je preizkus zmogen odpovedati: tolerance so izrecne."""
    def stevilo(s):
        try:
            return float(s.split()[0])
        except (ValueError, IndexError, AttributeError):
            return None
    i, tp = stevilo(k["I"]), stevilo(k["TP"])
    if i is None or tp is None:
        return "meritve ni bilo mogoce preciti"
    if abs(i - cilj["I"]) > 0.5:
        return f"I={i} zunaj tolerance {cilj['I']} +/-0,5 LU"
    if tp > cilj["TP"]:
        return f"TP={tp} nad pragom {cilj['TP']} dBTP"
    if tp < cilj["TP"] - 12:
        return f"TP={tp} prevec pod pragom — master je tihi"
    return None


def omeji_vrhove(miks, rez, jezik, ime, cilj, enota, meritev):
    """Vrhovi morajo biti pod pragom že PRED linearnim ojačanjem.

    loudnorm dvigne celotno mešanico za toliko, kolikor manjka do ciljne LUFS,
    in s tem dvigne tudi vrhove: mešanica, ki je izmerjena na -1,41 dBTP, ne more
    na -14 LUFS brez preloma praga -1,5 dBTP. Zato gre pred meritev izrecen
    omejevalnik, njegova meja pa se toliko časa spuščamo, dokler napoved
    končnega vrha ne pade pod prag z rezervo za med-vzorčne vrhove.
    """
    if "meja" not in cilj:
        return miks, meritev, None
    meja = cilj["meja"]
    omejen = os.path.join(SCRATCH, f"omejen-{rez}-{jezik}-{ime}.wav")
    for _ in range(6):
        izvedi(["-i", miks, "-af",
                f"alimiter=limit={10.0 ** (meja / 20.0):.4f}:attack=5:release=120:level=0",
                "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", omejen],
               f"limit-{rez}-{jezik}-{ime}", timeout=240)
        preveri_trajanje(omejen, enota, f"omejeno :{rez} {jezik} [{ime}]")
        nova_meritev = izmeri_r128(omejen, f"limit-mera-{rez}-{jezik}-{ime}")
        napoved = float(nova_meritev["input_tp"]) + (cilj["I"] - float(nova_meritev["input_i"]))
        if napoved <= cilj["TP"] - 0.4:
            print(f"    omejevalnik meja {meja:.1f} dBFS, napoved vrha {napoved:.2f} dBTP",
                  flush=True)
            return omejen, nova_meritev, meja
        print(f"    meja {meja:.1f} dBFS: napoved vrha {napoved:.2f} dBTP nad pragom, spuščamo",
              flush=True)
        meja -= 1.5
    raise SystemExit(f"OMEJEVANJE NI DOSEGLLO PRAGA za {rez}/{jezik} [{ime}] — "
                     f"pri {meja:.1f} dBFS še vedno {napoved:.2f} dBTP.")


def naredi(rez, jezik, samo_mojster=False, glasba=None, izhod=None, samo_cilji=None,
           obstojeci_miks=False, efekti=None):
    if obstojeci_miks:
        # Nov namen se piše čez že odobreni miks, da se zvočna plat ne more
        # raziti od različic, ki so že merjene in pregledane.
        m, enota, vrstice = kadi(rez, jezik)
        miks = os.path.join(SCRATCH, f"miks-{rez}-{jezik}.wav")
        if not os.path.exists(miks):
            raise SystemExit(f"NEDOSTAJA {miks} — brez mešanja ne morem pisati "
                             f"novega namena iz istega miksa.")
        preveri_trajanje(miks, enota, f"miks :{rez} {jezik}")
    else:
        m, enota, vrstice, miks = zmeši(rez, jezik, glasba, efekti)
    ciljna_mapa = izhod or ZVOK
    os.makedirs(ciljna_mapa, exist_ok=True)
    merjeno = izmeri_r128(miks, f"pred-{rez}-{jezik}")
    print(f":{rez} {jezik}  miks zmerjen ({merjeno['as_meitve']}s) "
          f"I={merjeno['input_i']} TP={merjeno['input_tp']}", flush=True)
    stari = None
    pot_lista = os.path.join(ciljna_mapa, f"namera-{rez}-{jezik}.json")
    if os.path.exists(pot_lista):
        with open(pot_lista, encoding="utf-8") as f:
            stari = json.load(f)
        # Pisati čez obstoječ miks sme samo iz mešanice, ki je že merjena: če se
        # vhod ne ujema, bi novi master nastal iz drugega posnetka kot odobreni.
        if obstojeci_miks:
            predhodna = (stari.get("miks_pred_poravnavo") or {}).get("input_i")
            if predhodna is not None and abs(float(predhodna) - float(merjeno["input_i"])) > 0.05:
                raise SystemExit(f"MIKS SE NE UJEMA: {rez}/{jezik} vhod {merjeno['input_i']} LUFS, "
                                 f"v listu {predhodna} — novi namen bi bil iz druge mešanice.")
    if efekti:
        with open(os.path.join(SCRATCH, os.path.basename(efekti).replace(".wav", ".json")),
                  encoding="utf-8") as f:
            e = json.load(f)
        stevilo = {}
        for postavek in e["postavitve"]:
            stevilo[postavek["vrsta"]] = stevilo.get(postavek["vrsta"], 0) + 1
        zapisi_efektov = {"datoteka": os.path.basename(efekti), "vrh_dbfs": e["vrh_dbfs"],
                          "po_vrsti": stevilo, "glasnosti": e["glasnosti"]}
    else:
        zapisi_efektov = None
    zapisi = {"rez": rez, "jezik": jezik, "enota": enota,
              "glas": m["zvok"]["pripoved_sl" if jezik == "sl" else "pripoved_en"]["glas"],
              "pripoved_skupaj": sum(v["govor"] for v in vrstice),
              "miks_pred_poravnavo": merjeno, "vrstice": vrstice,
              "efekti": zapisi_efektov, "izvozi": {}}
    if samo_cilji:
        cilji = {ime: CILJI[ime] for ime in samo_cilji}
    elif samo_mojster:
        cilji = {"mojster": CILJI["mojster"]}
    else:
        cilji = CILJI
    for ime, cilj in cilji.items():
        vhod, meritev, meja = omeji_vrhove(miks, rez, jezik, ime, cilj, enota, merjeno)
        ln = (f"loudnorm=I={cilj['I']}:TP={cilj['TP']}:LRA={cilj['LRA']}"
              f":measured_I={meritev['input_i']}:measured_TP={meritev['input_tp']}"
              f":measured_LRA={meritev['input_lra']}:measured_thresh={meritev['input_thresh']}"
              f":offset={meritev['target_offset']}:linear=true:print_format=summary")
        pot_master = os.path.join(ciljna_mapa, f"master-{rez}-{jezik}-{ime}.m4a")
        izvedi(["-i", vhod, "-af", ln, "-c:a", "aac", "-b:a", "192k",
                "-ar", "48000", "-ac", "2", "-movflags", "+faststart", pot_master],
               f"norm-{rez}-{jezik}-{ime}")
        kontrola = izmeri_r128(pot_master, f"post-{rez}-{jezik}-{ime}")
        k = kontrola["kontrola"]
        dej = trajanje(pot_master)
        if abs(dej - enota) > 0.12:
            raise SystemExit(f"NAPAKA {ime} :{rez} {jezik}: mojster traja {dej}s, "
                             f"ne {enota}s — platno in zvok se razideta.")
        napaka = preveri(k, cilj)
        zapisi["izvozi"][ime] = {"datoteka": os.path.relpath(pot_master, SPLAT).replace("\\", "/"),
                                 "cilj": cilj, "izmerjeno": k, "trajanje": dej,
                                 "odstopanje": napaka, "meritev": kontrola,
                                 "omejevalnik": meja}
        print(f":{rez} {jezik} [{ime}] -> {os.path.relpath(pot_master, SPLAT)}  {dej}s", flush=True)
        print(f"    pred  I={meritev['input_i']} TP={meritev['input_tp']} "
              f"LRA={meritev['input_lra']}"
              + (f"  (omejeno na {meja:.1f} dBFS)" if meja is not None else ""), flush=True)
        print(f"    kont  I={k['I']}  LRA={k['LRA']}  TP={k['TP']}  "
              + ("OK" if not napaka else "NEOK: " + napaka), flush=True)
        if napaka:
            zapisi["napaka"] = napaka
    # Delni poziv (--cilji) sme dopolniti časovni list, ne pa izbrisati dokazov
    # o namenih, ki se tokrat niso pisali: sicer bi zadnji izdelek potrdil le
    # zase, prejšnji mojstri pa bi ostali brez izmerjene sledi.
    if stari:
        for ime, podatek in (stari.get("izvozi") or {}).items():
            if ime in zapisi["izvozi"]:
                continue
            if not os.path.exists(os.path.join(SPLAT, podatek["datoteka"])):
                print(f"    opozorilo: {ime} iz starega lista nima več datoteke — izpuščen",
                      flush=True)
                continue
            zapisi["izvozi"][ime] = podatek
            print(f"    ohranjen {ime}: {podatek['datoteka']}", flush=True)
    with open(pot_lista, "w", encoding="utf-8") as f:
        json.dump(zapisi, f, ensure_ascii=False, indent=1)
        f.write("\n")
    return zapisi


def main():
    if not os.path.isdir(ZVOK):
        raise SystemExit(f"NEDOSTAJA {ZVOK}")
    samo_mojster = "--mojster" in sys.argv
    # --predogled: masterji gredo v Temp, spletna mapa zvok/ ostane taka,
    # kot je bila odobrena. Pilot se ne sme dotakniti koncne razlicice.
    predogled = "--predogled" in sys.argv
    izhod = os.path.join(os.environ["TEMP"], "rka-predogled") if predogled else None
    glasba_arg = next((a.split("=", 1)[1] for a in sys.argv
                       if a.startswith("--glasba=")), None)
    if glasba_arg:
        global GLASBA_LUFS
        GLASBA_LUFS = float(next((a.split("=", 1)[1] for a in sys.argv
                                  if a.startswith("--glasba-lufs=")), GLASBA_LUFS))
        nastavitev = next((a.split("=", 1)[1] for a in sys.argv
                           if a.startswith("--dusenje=")), None)
        if nastavitev:
            razmerje, sprositev = nastavitev.split(":")
            DUSENJE["razmerje"] = float(razmerje)
            DUSENJE["sprositev"] = float(sprositev)
        print(f"podlaga: cilj {GLASBA_LUFS} LUFS, dušenje "
              f"{DUSENJE['razmerje']:g}:1 / {DUSENJE['sprositev']:.0f} ms", flush=True)
    para = [a for a in sys.argv[1:] if not a.startswith("--")]
    kombinacije = [(para[0], para[1])] if len(para) >= 2 else \
                  [(r, j) for r in ("60", "30") for j in ("sl", "en")]
    # --cilji=mojster,splet: napiše se samo naštete namene. Neznano ime je
    # napaka v ukazu, ne tiho ignoriran parameter.
    cilji_arg = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--cilji=")), None)
    samo_cilji = None
    if cilji_arg:
        samo_cilji = [c.strip() for c in cilji_arg.split(",") if c.strip()]
        neznani = [c for c in samo_cilji if c not in CILJI]
        if neznani:
            raise SystemExit(f"NEZNAN NAMEN {', '.join(neznani)} — poznam: {', '.join(CILJI)}")
        print("izbrani nameni: " + ", ".join(samo_cilji), flush=True)
    # --efekti brez vrednosti = pričakovana pot do sintetizirane podlage za ta
    # par; --efekti=<pot> = izrecna datoteka. Naveden sans je namerno brez
    # efektov: odobrene različice morajo ostati ponovljive tudi pozneje.
    efekti_arg = next((a.split("=", 1)[1] if "=" in a else True for a in sys.argv
                       if a == "--efekti" or a.startswith("--efekti=")), None)
    if efekti_arg:
        print("četrti sloj efektov je vklopljen", flush=True)
    iz_miksa = "--miks" in sys.argv
    if iz_miksa:
        print("miks se ne meša na novo: novi namen gre čez že izmerjeno mešanico", flush=True)
    napovedane = []
    for rez, jezik in kombinacije:
        e = efekti_arg
        if e is True:
            # Brez vrednosti: pod razmerjem in jezikom pričakovano ime. Tako en
            # poziv pokrije vse štiri kombinacije, ne samo prve.
            e = os.path.join(SCRATCH, f"efekti-{rez}-{jezik}.wav")
        if e and not os.path.exists(e):
            raise SystemExit(f"NEDOSTAJA {e} — najprej: python rka-efekti-naredi.py {rez} {jezik}")
        z = naredi(rez, jezik, samo_mojster, glasba_arg, izhod, samo_cilji, iz_miksa, e)
        print(f":{rez} {jezik}  pripoved {z['pripoved_skupaj']:.1f} s "
              f"v {z['enota']} s kadra", flush=True)
        if z.get("napaka"):
            napovedane.append(f":{rez}/{jezik}: {z['napaka']}")
    print("\npoklicno: " + ", ".join(f"{r}/{j}" for r, j in kombinacije), flush=True)
    if napovedane:
        raise SystemExit("ZVOK NI SKLADEN Z EBU R128:\n  " + "\n  ".join(napovedane))


if __name__ == "__main__":
    main()
