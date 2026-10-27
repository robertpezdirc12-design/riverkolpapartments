/* Statični strežnik z byte-range podporo. Pythonov http.server je ne ponuja,
   brskalnik pa za <video> in <audio> terja 206 — brez nje se nalaganje zatakne
   in Page.loadEventFired nikoli ne pride.

   raba: node rka-streznik.cjs <mapa> <vrata>            (samostojno)
         const { zzeni } = require("./rka-streznik.cjs");  (iz izvoznika) */
const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4", ".m4a": "audio/mp4", ".webp": "image/webp",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8"
};

function postrezi(mapa, zahteva, odgovor) {
  const pot = decodeURIComponent((zahteva.url || "/").split("?")[0]);
  const rel = pot === "/" ? "index.html" : pot.replace(/^\/+/, "");
  const dat = path.resolve(mapa, rel);
  /* Upanje izven korena: /. je edini dovoljen začetek. */
  if (!dat.startsWith(path.resolve(mapa) + path.sep) && dat !== path.resolve(mapa)) {
    odgovor.writeHead(403).end(); return;
  }
  let st;
  try { st = fs.statSync(dat); } catch { odgovor.writeHead(404).end("ni datoteke"); return; }
  if (st.isDirectory()) { odgovor.writeHead(404).end(); return; }

  const glave = {
    "Content-Type": MIME[path.extname(dat).toLowerCase()] || "application/octet-stream",
    "Accept-Ranges": "bytes", "Cache-Control": "no-store", "Content-Length": String(st.size)
  };
  const rang = zahteva.headers.range;
  const m = rang && /^bytes=(\d*)-(\d*)$/.exec(rang);
  if (m && (m[1] || m[2])) {
    let zacetek = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2] || 0));
    let konec = m[2] && m[1] !== "" ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
    if (zacetek > konec || zacetek >= st.size) {
      odgovor.writeHead(416, { "Content-Range": `bytes */${st.size}` }).end(); return;
    }
    odgovor.writeHead(206, { ...glave,
      "Content-Range": `bytes ${zacetek}-${konec}/${st.size}`,
      "Content-Length": String(konec - zacetek + 1) });
    fs.createReadStream(dat, { start: zacetek, end: konec }).pipe(odgovor);
    return;
  }
  odgovor.writeHead(200, glave);
  if (zahteva.method === "HEAD") { odgovor.end(); return; }
  fs.createReadStream(dat).pipe(odgovor);
}

function zzeni(mapa, vrata) {
  const s = http.createServer((z, o) => {
    try { postrezi(mapa, z, o); }
    catch (e) { if (!o.headersSent) o.writeHead(500); o.end("napaka: " + e.message); }
  });
  /* Zasedena vrata pridejo kot 'error' dogodek, ne kot izjema: brez tega vise. */
  return new Promise((res, rej) => {
    s.once("error", rej);
    s.listen(vrata, "127.0.0.1", () => res(s));
  });
}

module.exports = { zzeni };

if (require.main === module) {
  const [mapa, vrata] = process.argv.slice(2);
  if (!mapa || !vrata) throw new Error("raba: node rka-streznik.cjs <mapa> <vrata>");
  zzeni(mapa, Number(vrata)).then(() =>
    console.log(`postrezen http://127.0.0.1:${vrata}  iz ${mapa}  (range podprt)`));
}
