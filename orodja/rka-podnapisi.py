#!/usr/bin/env python3
"""Stranjske podnapise .srt/.vtt generira iz izmerjenega časovnega lista pripovedi.

En sam vir resnice: zvok/namera-<rez>-<jezik>.json, kjer sta zac in kader_konec
izmerjena iz dejanskih valovnih oblik. Nič se ne šteje nazaj iz oken.
"""
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import glob, json, re, sys
from pathlib import Path

STR = Path(r"C:\Users\admin\Downloads\sssdf\rka-onepage")
VID = Path(r"C:\Users\admin\Downloads\sssdf\rka-reklama")
NAJDALEJ = 42  # pravilo podnapisov: dve vrstici, vsaka do 42 znakov


def cas(s, decimal=","):
    ms = int(round(s * 1000))
    h, ms = divmod(ms, 3600_000)
    m, ms = divmod(ms, 60_000)
    sek, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{sek:02d}{decimal}{ms:03d}"


def prelomi(besedilo):
    if len(besedilo) <= NAJDALEJ:
        return [besedilo]
    mesta = [i for i, ch in enumerate(besedilo) if ch == " "]
    razpolovljena = min(mesta, key=lambda i: abs(i - len(besedilo) / 2))
    return [besedilo[:razpolovljena].rstrip(), besedilo[razpolovljena + 1:].lstrip()]


def vrstice(rez, jezik):
    namera = json.loads((STR / "zvok" / f"namera-{rez}-{jezik}.json").read_text(encoding="utf-8"))
    v = namera["vrstice"]
    out = []
    for i, r in enumerate(v):
        zac = r["zac"]
        konec = r["kader_konec"]
        if i + 1 < len(v):
            konec = min(konec, v[i + 1]["zac"] - 0.001)
        if konec <= zac:
            raise SystemExit(f"{rez}-{jezik} {r['kader']}: konec {konec} ni za začetkom {zac}")
        out.append({"kader": r["kader"], "zac": zac, "konec": konec, "besedilo": r["besedilo"]})
    return out


def napisi_srt(pot, cues):
    vr = ["%d\n%s --> %s\n%s\n" % (i + 1, cas(c["zac"]), cas(c["konec"]),
                                   "\n".join(prelomi(c["besedilo"])))
          for i, c in enumerate(cues)]
    Path(pot).write_text("\n".join(vr), encoding="utf-8", newline="\n")


def napisi_vtt(pot, cues, jezik):
    vr = ["WEBVTT", "Kind: captions", f"Language: {jezik}", ""]
    vr += ["%s --> %s\n%s\n" % (cas(c["zac"], "."), cas(c["konec"], "."),
                                "\n".join(prelomi(c["besedilo"])))
           for c in cues]
    Path(pot).write_text("\n".join(vr), encoding="utf-8", newline="\n")


napisi = []
for mp4 in sorted(glob.glob(str(VID / "rka-*.mp4"))):
    ime = Path(mp4).stem
    m = re.fullmatch(r"rka-(\d\d)-(sl|en)-(\w+)", ime)
    if not m:
        print(f"preskočeno (ne ustreza obrazcu): {ime}")
        continue
    rez, jezik, _varianta = m.groups()
    cues = vrstice(rez, jezik)
    srt, vtt = ime + ".srt", ime + ".vtt"
    napisi_srt(VID / srt, cues)
    napisi_vtt(VID / vtt, cues, jezik)
    napisi.append((ime, len(cues)))

print(f"zapisani pari za {len(napisi)} posnetkov:")
for ime, n in napisi:
    print(f"  {ime}.srt/.vtt — {n} vrstic")
