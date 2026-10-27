# Slikovni A/B: nova rezija proti varovani kopiji iz _pred-gibom-2026-10-26.
#
# Zakaj je to potrebno: portoli (izvoz, podnapisi, gib) preverjajo LASTNOSTI
# datoteke — trajanje, platno, barve, glasnost, utrip. Noben od njih ne pove, ali
# je živa plast (UBLAG/ROKA/PI/SMER) sploh prišla do pikslov. Brez te meritve bi
# trditev "izvoz vsebuje živo plast" ostala domneva iz kode, ne izmerjeno dejstvo.
#
# Meritev: blend=all_mode=difference → sivi produkt → signalstats YAVG (povprečna
# absolutna razlika na 0..255). Oba okvirja se vzamesta pri isti časovni oznaki.
#
# Falsificiranje (brez kontrol zelen port ne pomeni ničesar):
#   K1  isto proti istemu mora biti 0 — sicer ničelni nivo ni ničeln
#   K2/K3 izdelki istega platna (mojster | splet | družbeno) si delijo isti video
#       tok, zato mora biti njihova razlika 0. To je tudi razlog, da se dragi
#       profili merijo na 8 platnih, ne na 14 izdelkih.
#
# Zgornje meje ni izmislica: prva različica je zahtevala YAVG < 8,0, prva meritev
# pa je dala 11,3 — meja brez meritve ne trdi ničesar. Referenca se izmeri v istem
# zagonu: kolikšna je lastna sprememba posnetka v eni sekundi (nova @ t proti
# nova @ t+1 s). Odklon reži sme ostati znotraj gibanja, ki ga ta spot sam pokaže;
# če ga preseže, rezija ni več "ista zgodba z drugačnim tempom", ampak druga slika.
import json, os, subprocess, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REKLAMA = r"C:\Users\admin\Downloads\sssdf\rka-reklama"
VAROVA = os.path.join(REKLAMA, "_pred-gibom-2026-10-26")
FFMPEG = r"C:\Users\admin\.qoder\bin\ffmpeg.exe"

DMERNO_DNO = 0.02     # pod tem je razlika za oko nična
NICELNA_MEREA = 0.005  # meja, pri kateri še veljamo, da je razlika nič

IZDELKI = [
    "rka-60-sl-mojster.mp4", "rka-60-sl-splet.mp4", "rka-60-sl-druzbeno.mp4",
    "rka-60-en-splet.mp4", "rka-60-en-druzbeno.mp4",
    "rka-30-sl-mojster.mp4", "rka-30-sl-splet.mp4", "rka-30-sl-druzbeno.mp4",
    "rka-30-en-splet.mp4", "rka-30-en-druzbeno.mp4",
    "rka-60-sl-druzbeno-pokonci.mp4", "rka-60-en-druzbeno-pokonci.mp4",
    "rka-30-sl-druzbeno-pokonci.mp4", "rka-30-en-druzbeno-pokonci.mp4",
]

CAS_60 = [1.0, 6.0, 11.0, 16.0, 21.0, 26.0, 31.0, 36.0, 41.0, 46.0, 51.0, 56.0]
CAS_30 = [0.5, 3.0, 5.5, 8.0, 10.5, 13.0, 15.5, 18.0, 20.5, 23.0, 25.5, 28.0]

# (ime platna, predstavnik, časovne oznake)
PLATNA = [
    ("60 sl ležeče", "rka-60-sl-splet.mp4", CAS_60),
    ("60 en ležeče", "rka-60-en-splet.mp4", CAS_60),
    ("30 sl ležeče", "rka-30-sl-splet.mp4", CAS_30),
    ("30 en ležeče", "rka-30-en-splet.mp4", CAS_30),
    ("60 sl pokončno", "rka-60-sl-druzbeno-pokonci.mp4", CAS_60),
    ("60 en pokončno", "rka-60-en-druzbeno-pokonci.mp4", CAS_60),
    ("30 sl pokončno", "rka-30-sl-druzbeno-pokonci.mp4", CAS_30),
    ("30 en pokončno", "rka-30-en-druzbeno-pokonci.mp4", CAS_30),
]
# Soplani izdelki morajo imeti bitno enak video tok predstavnika.
SOPLATNI = {
    "rka-60-sl-splet.mp4": ["rka-60-sl-mojster.mp4", "rka-60-sl-druzbeno.mp4"],
    "rka-60-en-splet.mp4": ["rka-60-en-druzbeno.mp4"],
    "rka-30-sl-splet.mp4": ["rka-30-sl-mojster.mp4", "rka-30-sl-druzbeno.mp4"],
    "rka-30-en-splet.mp4": ["rka-30-en-druzbeno.mp4"],
}


def stevilo_okvirov(pot):
    """Število okvirjev iz moata. Štetje okvirjev bi za vsak par predelalo cel
       posnetek, preverjanj pa je 28; brez prave številke pride na izjemo, ne na
       približek."""
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=nb_frames,r_frame_rate", "-of", "json", pot],
        capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise RuntimeError("ffprobe ni uspel za " + os.path.basename(pot) +
                           ": " + (r.stderr or "").strip())
    pretok = json.loads(r.stdout)["streams"][0]
    if not pretok.get("nb_frames"):
        raise RuntimeError("%s: moat nima številke okvirjev — primerjava bi utripanje prikrila"
                           % os.path.basename(pot))
    return int(pretok["nb_frames"])


def yavg(prva, c_prva, druga, c_druga):
    """Povprečna siva razlika enega para okvirjev.

    metadata=print piše po informacijskem kanalu: z -loglevel error filter teče, a
    izpiše nič, mera bi bila tiho napačna namesto glasno napačna."""
    r = subprocess.run(
        [FFMPEG, "-hide_banner", "-loglevel", "info", "-nostdin",
         "-ss", "%.4f" % c_prva, "-i", prva,
         "-ss", "%.4f" % c_druga, "-i", druga,
         "-filter_complex",
         "[0:v][1:v]blend=all_mode=difference,format=gray,signalstats,metadata=print",
         "-frames:v", "1", "-an", "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise RuntimeError("blend ni uspel @ %.2f s: %s" % (c_prva, (r.stderr or "").strip()[-400:]))
    for vrstica in (r.stderr or "").splitlines():
        if "lavfi.signalstats.YAVG=" in vrstica:
            return float(vrstica.split("lavfi.signalstats.YAVG=")[1].split()[0])
    raise RuntimeError("pri %.2f s ni izmerjenega YAVG (filter se ni izvedel)" % c_prva)


def par(ime):
    return os.path.join(REKLAMA, ime), os.path.join(VAROVA, ime)


napake = []
st_meritev = 0

print("=== KONTROLA K1: isto proti istemu (mora biti 0) ===")
eni = os.path.join(REKLAMA, IZDELKI[0])
k1 = yavg(eni, CAS_60[2], eni, CAS_60[2])
print("  samo-razlika = %.5f" % k1)
if k1 > NICELNA_MEREA:
    napake.append("K1: samo-razlika ni nič (%.5f) — merski nivo ni zanesljiv" % k1)

print("\n=== OKVIRJI: novi proti varovani kopiji (mora biti enako) ===")
for ime in IZDELKI:
    n, s = par(ime)
    if not os.path.exists(n):
        napake.append("manjka novi " + ime)
        continue
    if not os.path.exists(s):
        napake.append("manjka varovani " + ime)
        continue
    fn, fs = stevilo_okvirov(n), stevilo_okvirov(s)
    if fn != fs:
        napake.append("%s: okvirjev %d (novi) proti %d (varovani)" % (ime, fn, fs))
    print("  %-34s %5d proti %5d" % (ime, fn, fs))

print("\n=== KONTROLI K2/K3: izdelki istega platna si delijo video (mora biti 0) ===")
for predstavnik, sosedi in SOPLATNI.items():
    for baza, rok in ((VAROVA, "varovani"), (REKLAMA, "novi")):
        if not os.path.exists(os.path.join(baza, predstavnik)):
            continue
        for sosed in sosedi:
            if not os.path.exists(os.path.join(baza, sosed)):
                continue
            razlika = yavg(os.path.join(baza, predstavnik), CAS_60[2],
                           os.path.join(baza, sosed), CAS_60[2])
            st_meritev += 1
            if razlika > NICELNA_MEREA:
                napake.append("%s: %s proti %s se razlikuje (%.5f) — izdelki istega platna "
                              "nimajo istega videa" % (rok, predstavnik, sosed, razlika))
        print("  %-9s %-32s %d pari" % (rok, predstavnik, len(sosedi)))

print("\n=== NOVO PROTI STAREMU po platnih ===")
for ime_platna, predstavnik, casovi in PLATNA:
    n, s = par(predstavnik)
    if not (os.path.exists(n) and os.path.exists(s)):
        napake.append("%s: paru manjka datoteka, profil se ni izmeril" % ime_platna)
        continue
    profil = [yavg(s, c, n, c) for c in casovi]
    st_meritev += len(profil)
    referenca = [yavg(n, c, n, c + 1.0) for c in casovi[::3]]
    st_meritev += len(referenca)
    povpr = sum(profil) / len(profil)
    ref = sum(referenca) / len(referenca)
    print("  %-16s povpr=%6.3f  max=%6.3f  referenca (1 s lastnega gibanja)=%6.3f" %
          (ime_platna, povpr, max(profil), ref))
    print("       profil @ " + " ".join("%.0f" % c for c in casovi))
    print("       razlika  " + " ".join("%.2f" % v for v in profil))
    if max(profil) < DMERNO_DNO:
        napake.append("%s: razlika pod merskim dnom — živa plast NI prišla do pikslov" % ime_platna)
    if ref <= NICELNA_MEREA:
        napake.append("%s: referenčno gibanje je nič — mera nima seštevka, primerjati ni česa" % ime_platna)
    elif povpr > ref:
        napake.append("%s: odklon %.3f presega lastno gibanje posnetka %.3f — rezija ni ista zgodba"
                      % (ime_platna, povpr, ref))

print("\nplatn v pregledu: %d | izvedenih meritev razlike: %d" % (len(PLATNA), st_meritev))
if st_meritev < 80:
    napake.append("izvedenih je samo %d meritev — port je lahko zelen zaradi nepopravljenega dela" % st_meritev)

print()
if napake:
    print("NAPAKE (%d):" % len(napake))
    for n in napake:
        print("  - " + n)
    sys.exit(1)
print("V REDU: živa plast je izmerljivo spremenila piksle na vseh 8 platnih, odklon "
      "ostaja znotraj lastnega gibanja posnetka, ničelne kontrole so ničelne.")
