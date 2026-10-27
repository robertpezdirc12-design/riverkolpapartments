# Zmeri, kaj glasbeni sloj dejansko pade pod govor: podlaga se postavi trikrat
# (sama, dušena z govorom) in se meri; govor se meri posebej.
#
# raba: python rka-podlaga-mera.py <rez> <jezik> <glasba.mp3> [--glasba-lufs=-17]
#
# Izpis pove tri stevilke, ki jih rabimo za odlocitev:
#   podlaga sama     = raven, ki jo doloci ojacanje
#   podlaga dusena   = raven, ki ostane, ko govori pripovedovalec
#   globina dusenja  = razlika; 6-10 dB je TV norma za podlogo pod govorom
# Ce je dusena podlaga vec kot 12 dB pod govorom, je v praksi neslysna.
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json
import os
import subprocess
import sys

SPLAT = r"C:\Users\admin\Downloads\sssdf\rka-onepage"
ZVOK = os.path.join(SPLAT, "zvok")
SCRATCH = os.path.join(os.environ["TEMP"], "rka-podlaga-mera")
FFMPEG = r"C:\Users\admin\.qoder\bin\ffmpeg.exe"


def izvedi(vhodi, filtri, izhodi, enota):
    # Vsak izhod dobi svoje izhodne opcije: v ffmpeg ukazni vrsti veljajo opcije
    # za naslednjo datoteko, zato se ne smejo zapisati enkrat na konec.
    izhodni_del = []
    for pot, oznaka in zip(izhodi, ["sami", "ducena", "govor"]):
        izhodni_del += ["-t", f"{enota}", "-ac", "2", "-ar", "48000",
                        "-c:a", "pcm_s16le", "-map", f"[{oznaka}]", pot]
    r = subprocess.run([FFMPEG, "-hide_banner", "-nostdin", "-loglevel", "error", "-y"]
                       + vhodi + ["-filter_complex", ";".join(filtri)] + izhodni_del,
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"ffmpeg odpovedal ({izhodi[0]}):\n{r.stderr[-1200:]}")


def lufs(pot):
    r = subprocess.run([FFMPEG, "-hide_banner", "-nostdin", "-nostats", "-i", pot,
                        "-af", "loudnorm=I=-23:TP=-1.5:print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True, check=True)
    besedilo = r.stderr
    if "{" not in besedilo:
        raise SystemExit(f"NI MERITVE za {pot}")
    return float(json.loads(besedilo[besedilo.find("{"):besedilo.rfind("}") + 1])["input_i"])


rez, jezik, glasba = sys.argv[1:4]
cilj = float(next((a.split("=", 1)[1] for a in sys.argv[4:]
                   if a.startswith("--glasba-lufs=")), -22.0))
with open(os.path.join(ZVOK, f"namera-{rez}-{jezik}.json"), encoding="utf-8") as f:
    z = json.load(f)
enota = z["enota"]
vrstice = z["vrstice"]
os.makedirs(SCRATCH, exist_ok=True)

vhodi = ["-stream_loop", "2", "-t", f"{enota}", "-i", glasba]
for j, v in enumerate(vrstice, start=1):
    vhodi += ["-i", v["wav"]]
ojacanje = None
r = subprocess.run([FFMPEG, "-hide_banner", "-nostdin", "-nostats", "-i", glasba,
                    "-af", "loudnorm=I=-23:TP=-1.5:print_format=json",
                    "-f", "null", "-"], capture_output=True, text=True, check=True)
vhod_i = float(json.loads(r.stderr[r.stderr.find("{"):r.stderr.rfind("}") + 1])["input_i"])
ojacanje = 10.0 ** ((cilj - vhod_i) / 20.0)

niz = [f"[0:a]aresample=48000,atrim=0:{enota},asetpts=PTS-STARTPTS,"
       f"highpass=f=60,lowpass=f=12000,volume={ojacanje:.4f},"
       f"afade=t=in:st=0:d=1.2,afade=t=out:st={round(enota - 2.5, 3)}:d=2.5,"
       "aformat=sample_rates=48000:channel_layouts=stereo[glas]"]
oznake = []
for j, v in enumerate(vrstice, start=1):
    ms = int(round(v["zac"] * 1000))
    niz.append(f"[{j}:a]aresample=48000,adelay={ms}|{ms},"
               "aformat=sample_rates=48000:channel_layouts=stereo[go%d]" % j)
    oznake.append(f"[go{j}]")
niz.append("".join(oznake) + f"amix=inputs={len(vrstice)}:duration=longest:"
             f"normalize=0,apad=whole_dur={enota}[vogov]")
niz.append("[glas]asplit=2[glasA][glasB]")
niz.append("[vogov]asplit=2[sc1][govor]")
niz.append("[glasB][sc1]sidechaincompress=threshold=0.08:ratio=4:attack=40:"
           "release=220:makeup=1[duc]")
# Tri izhodi v enem graku: sicer ostane nepvezan izhod filta, kar ffmpeg zavrne.
niz += ["[glasA]anull[sami]", "[duc]anull[ducena]", "[govor]anull[govor]"]

sami = os.path.join(SCRATCH, f"podlaga-sama-{rez}-{jezik}.wav")
ducena = os.path.join(SCRATCH, f"podlaga-ducena-{rez}-{jezik}.wav")
govor = os.path.join(SCRATCH, f"govor-{rez}-{jezik}.wav")
izvedi(vhodi, niz, [sami, ducena, govor], enota)

a, b, g = lufs(sami), lufs(ducena), lufs(govor)
print(f"podlaga sama    {a:6.2f} LUFS")
print(f"podlaga dusena  {b:6.2f} LUFS")
print(f"govor           {g:6.2f} LUFS")
print(f"globina dusenja {a - b:5.2f} dB   podlaga pod govorom {g - b:5.2f} dB")
print(f"ojacanje {ojacanje:.3f} (vhod {vhod_i:.2f} -> cilj {cilj} LUFS)")
for pot in (sami, ducena, govor):
    os.remove(pot)
