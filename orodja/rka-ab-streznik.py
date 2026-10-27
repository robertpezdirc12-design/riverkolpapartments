#!/usr/bin/env python3
# Statistronicar za A/B poslusanje. Pythonov http.server zna postreči samo celotno
# datoteko: brskalnik zato iskanja po posnetku ne more izvesti (poskus pomika tiho
# razveljavi). Ta streznik vrne 206 s Content-Range in je edina razlicica, kjer
# sonda dejansko vidi skok na 30,00 s.
#
#   raba: python rka-ab-streznik.py [vrata]      # privzeto 4188, samo 127.0.0.1
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import os, re, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

MAPA = os.path.join(os.environ["TEMP"], "rka-ab")
TIPI = {".m4a": "audio/mp4", ".mp4": "video/mp4", ".wav": "audio/wav",
        ".html": "text/html; charset=utf-8", ".json": "application/json",
        ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml"}


class Zahteva(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, oblika, *arg):
        sys.stderr.write("%s - %s\n" % (self.address_string(), oblika % arg))

    def pot(self):
        cista = unquote(self.path.split("?")[0].split("#")[0])
        if cista.endswith("/"):
            cista += "index.html"
        resna = os.path.normpath(os.path.join(MAPA, cista.lstrip("/")))
        # pot mora ostati v mapi: .. ali absolutna pot zunaj nje je zavrnjena
        if os.path.commonpath([MAPA, resna]) != MAPA:
            return None
        return resna if os.path.isfile(resna) else None

    def postrezi(self, glava):
        resna = self.pot()
        if resna is None:
            self.send_error(404, "Ni take datoteke")
            return
        velikost = os.path.getsize(resna)
        tip = TIPI.get(os.path.splitext(resna)[1].lower(), "application/octet-stream")
        obseg = self.headers.get("Range")
        zacetek, konec, delni = 0, velikost - 1, False
        if obseg:
            ujeto = re.fullmatch(r"bytes=(\d*)-(\d*)", obseg.strip())
            if not ujeto or (ujeto.group(1), ujeto.group(2)) == ("", ""):
                self.send_error(400, "Narobe naveden obseg")
                return
            a, b = ujeto.group(1), ujeto.group(2)
            if a == "":                       # bytes=-N: zadnjih N bajtov
                konec, zacetek = velikost - 1, max(0, velikost - int(b))
            else:
                zacetek = int(a)
                konec = min(int(b) if b else velikost - 1, velikost - 1)
            if zacetek > konec or zacetek >= velikost:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{velikost}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            delni = True
        dolzina = konec - zacetek + 1
        self.send_response(206 if delni else 200)
        self.send_header("Content-Type", tip)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(dolzina))
        if delni:
            self.send_header("Content-Range", f"bytes {zacetek}-{konec}/{velikost}")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if glava:
            return
        with open(resna, "rb") as f:
            f.seek(zacetek)
            ostalo = dolzina
            while ostalo > 0:
                kos = f.read(min(1 << 16, ostalo))
                if not kos:
                    break
                self.wfile.write(kos)
                ostalo -= len(kos)

    def do_GET(self):
        self.postrezi(False)

    def do_HEAD(self):
        self.postrezi(True)


if __name__ == "__main__":
    vrata = int(sys.argv[1]) if len(sys.argv) > 1 else 4188
    if not os.path.isdir(MAPA):
        raise SystemExit(f"NEDOSTAJA {MAPA}")
    streznik = ThreadingHTTPServer(("127.0.0.1", vrata), Zahteva)
    print(f"postrežba {MAPA} na http://127.0.0.1:{vrata}/ (z obsegi)", flush=True)
    streznik.serve_forever()
