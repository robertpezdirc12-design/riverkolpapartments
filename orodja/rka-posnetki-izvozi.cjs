/* Corpus za rka-posnetki-proveri.py sme nastati samo iz dostavljenih MP4.
   Stari zagoni so v mapo rka-shot mešali zaslone brskalniških zajemov (rka-stran-*,
   rka-proba-*), zato je orodje 25. 10. javilo tri črne kadre, ki v datotekah niso
   črni. Vsak kader se torej izreže iz datoteke, ki jo dejansko predajamo. */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const STRAN = "C:\\Users\\admin\\Downloads\\sssdf\\rka-onepage";
const IZVOZ = "C:\\Users\\admin\\Downloads\\sssdf\\rka-reklama";
const MAPA = process.argv[2] || (process.env.TEMP + "\\rka-shot-kadri");

/* [oznaka, datoteka, rez] — mojster za SL, splet za EN: tisto, kar gre naprej. */
const PROIZVODI = [
  ["sl60", "rka-60-sl-mojster.mp4", "60"],
  ["en60", "rka-60-en-splet.mp4", "60"],
  ["sl30", "rka-30-sl-mojster.mp4", "30"],
  ["en30", "rka-30-en-splet.mp4", "30"]
];

const spot = JSON.parse(fs.readFileSync(path.join(STRAN, "spot.json"), "utf8"));
fs.mkdirSync(MAPA, { recursive: true });
for (const f of fs.readdirSync(MAPA)) if (/^rka-.*\.png$/.test(f)) fs.unlinkSync(path.join(MAPA, f));

let narejenih = 0, napake = [];
for (const [ozn, datoteka, rez] of PROIZVODI) {
  /* Središče kadra: tam prehod ni odprt in ni še zaprt. */
  let t = 0; const sredine = new Map();
  for (const [id, okno] of spot.rezi[rez].niz) { sredine.set(id, t + okno / 2); t += okno; }
  const pot = path.join(IZVOZ, datoteka);
  if (!fs.existsSync(pot)) { napake.push(datoteka + ": datoteke ni"); continue; }
  for (const [id, cas] of sredine) {
    const izhod = path.join(MAPA, `rka-${ozn}-${id}.png`);
    try {
      execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", cas.toFixed(3), "-i", pot,
        "-frames:v", "1", "-update", "1", izhod], { stdio: "ignore" });
      narejenih++;
    } catch (e) { napake.push(ozn + "/" + id + ": " + e.message); }
  }
}
console.log(`zajetih kadrov: ${narejenih} v ${MAPA}`);
if (napake.length) { console.log("napake:"); napake.forEach(n => console.log("  - " + n)); process.exit(1); }
if (narejenih < PROIZVODI.length * 10) { console.log("NI V REDU: preveč kadrov ni uspelo."); process.exit(1); }
console.log("V REDU: corpus je pripravljen za rka-posnetki-proveri.py");
