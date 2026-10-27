/* Postavi ali odstrani JAVNI NASLOV (osnovo) v metapodatkih obeh strani.

   Zakaj sploh skripta in ne ročni popravek: absolutnih URL-jev pred objavo ni
   mogoče izmisliti, hkrati pa jih je treba spremeniti na devetih mestih v dveh
   datotekah: og:image, twitter:image, JSON-LD image, JSON-LD url, og:url in
   canonical. Kjer se toliko mest menja ročno, eno ostane staro — in prav taka
   tiha napaka se v brskalniku ne pokaže: delitvena kartica preprosto ostane brez
   slike. Zato jih spremeni eden sam izraz, v obe smeri.

   Uporaba:
     node rka-postavi-osnovo.cjs --base=https://primer.si/rka    (suho, samo izpiše)
     node rka-postavi-osnovo.cjs --base=https://primer.si/rka --zapisi
     node rka-postavi-osnovo.cjs --odstrani --zapisi              (nazaj na lokalno)
   Brez --zapisi se datoteke NE dotakne.

   Skripta je IDEMPOTENTNA in PRENOSLJIVA: vrednosti vsakič izračuna iz potskega
   dela, ki je že v datoteki. Zato deluje tudi ob menjavi domene in tudi kadar
   pozneje, ko osnovo postaviš dvakrat. */
const fs = require("fs");
const path = require("path");

const DOM = "C:\\Users\\admin\\Downloads\\sssdf\\rka-onepage";

/* Katera polja ima katera datoteka — skripta ne ugiba manjkajočih in ne piše
   novih Twitter-polj na stran, ki jih namenoma nima (Twitter takrat usede na
   og:description in og:image). */
const DATOTEKE = {
  "index.html": { slike: ["og:image", "twitter:image", "json-ld image"], jsonLdUrl: true },
  "zgodba.html": { slike: ["og:image"], jsonLdUrl: false }
};

const args = process.argv.slice(2);
const zastavica = ime => args.some(a => a === "--" + ime);
const doloc = ime => {
  const a = args.find(v => v.startsWith("--" + ime + "="));
  return a ? a.slice(ime.length + 3) : null;
};

const OSNOVA = doloc("base");
const ODSTRANI = zastavica("odstrani");
if (OSNOVA && ODSTRANI) {
  console.error("izberi eno: --base=https://… ali --odstrani");
  process.exit(2);
}
if (!OSNOVA && !ODSTRANI) {
  console.error("manjka --base=https://… (javen naslov) ali --odstrani (nazaj na lokalno pot)");
  process.exit(2);
}
if (OSNOVA) {
  if (!/^https?:\/\/[^/]/.test(OSNOVA)) {
    console.error(`--base ne izgleda kot absoluten naslov: ${OSNOVA}`);
    process.exit(2);
  }
  if (/[?#]/.test(OSNOVA)) {
    console.error(`--base sme imeti samo pot, ne poizvedbe ali sidra: ${OSNOVA}`);
    process.exit(2);
  }
}
const BAZA = OSNOVA ? OSNOVA.replace(/\/+$/, "") : null;

/* Lokalna pot slike — vse od prvega '/assets/' naprej, ne glede na to, ali je
   vrednost absolutna, koren-relativna ali relativna.

   Sidro je 'assets/', ne 'domena + pot': sicer bi prehod z enega javnega naslova
   na drugega (riverkolpa.si → github.io/rka-onepage) podvojil pot. Predpostavka
   je resnična za to stran — vsi njeni datoteki ležita v mapi assets/ — in kadar
   je ne drži, skripta raje javi napako kot pa zapiše poti, ki ne obstaja. */
function potSlike(vrednost) {
  if (!vrednost) return null;
  const v = vrednost.trim();
  const zacetek = /^https?:\/\//.test(v) ? v.indexOf("/", v.indexOf("//") + 2) : 0;
  const i = v.indexOf("/assets/", zacetek);
  return i >= 0 ? v.slice(i) : null;
}

const RE = {
  "og:image": /(<meta property="og:image" content=")([^"]*)(")/,
  "twitter:image": /(<meta name="twitter:image" content=")([^"]*)(")/,
  "json-ld image": /("image":\s*")([^"]*)(")/,
  "og:url": /(<meta property="og:url" content=")([^"]*)(")/,
  "canonical": /(<link[^>]*rel="canonical"[^>]*href=")([^"]*)(")/,
  "json-ld url": /("url":\s*")([^"]*)(")/
};
/* Celotna vrsta, ki se izbriše, ko osnovo odstranjujemo. */
const VRSTA = {
  "og:url": /^[ \t]*<meta property="og:url"[^>]*>\r?\n/m,
  "canonical": /^[ \t]*<link[^>]*rel="canonical"[^>]*>\r?\n/m,
  "json-ld url": /^[ \t]*"url":\s*"[^"]*",\r?\n/m
};
/* Kam se vrsta vstavi, ko je v datoteki še ni. */
const SIDRO = {
  "og:url": k => k.match(/<meta property="og:locale"[^>]*>\r?\n/),
  "canonical": k => k.match(/<title>.*?<\/title>\r?\n/),
  "json-ld url": k => k.match(/^([ \t]*)"image":\s*"[^"]*",\r?\n/m)
};
const VRSTA_NOVA = {
  "og:url": v => `<meta property="og:url" content="${v}">\n`,
  "canonical": v => `<link rel="canonical" href="${v}">\n`,
  "json-ld url": (v, sidro) => `${sidro[1]}"url": "${v}",\n`
};

let spremembe = 0, izpusten = 0;
for (const [ime, nast] of Object.entries(DATOTEKE)) {
  const pot_dat = path.join(DOM, ime);
  let b = fs.readFileSync(pot_dat, "utf-8");
  const izvorni = b;
  const vrstice = [];

  for (const polje of nast.slike) {
    const m = b.match(RE[polje]);
    if (!m) { vrstice.push(`  ${polje} — niz ni najden (skripta ne ugiba)`); izpusten++; continue; }
    const p = potSlike(m[2]);
    if (!p) { vrstice.push(`  ${polje} — vrednosti ${m[2]} ne prepoznam: ne vsebuje '/assets/'`); izpusten++; continue; }
    const nova = ODSTRANI ? p : `${BAZA}${p}`;
    if (m[2] === nova) { vrstice.push(`  ${polje} že pravilna`); continue; }
    b = b.replace(RE[polje], (_x, a, _s, c) => a + nova + c);
    vrstice.push(`  ${polje}: ${m[2]} → ${nova}`);
    spremembe++;
  }

  const lastni = ime === "index.html" ? `${BAZA}/` : `${BAZA}/${ime}`;

  const urejaj = polje => {
    const m = b.match(RE[polje]);
    if (ODSTRANI) {
      if (!m) { vrstice.push(`  ${polje} že odstranjen`); return; }
      const vrsta = b.match(VRSTA[polje]);
      if (!vrsta) {
        b = b.replace(RE[polje], (_x, a, _s, c) => a + c);
        vrstice.push(`  ${polje}: vrednost izpraznjena, ker ne stoji na samostojni vrsti`);
      } else {
        b = b.replace(vrsta[0], () => "");
        vrstice.push(`  ${polje} odstranjen`);
      }
      spremembe++;
      return;
    }
    if (m) {
      if (m[2] === lastni) { vrstice.push(`  ${polje} že pravilen`); return; }
      b = b.replace(RE[polje], (_x, a, _s, c) => a + lastni + c);
      vrstice.push(`  ${polje}: ${m[2]} → ${lastni}`);
      spremembe++;
      return;
    }
    const sidro = SIDRO[polje](b);
    if (!sidro) { vrstice.push(`  ${polje} — ni sidra za vstavljanje`); izpusten++; return; }
    b = b.replace(sidro[0], () => sidro[0] + VRSTA_NOVA[polje](lastni, sidro));
    vrstice.push(`  ${polje} dodan → ${lastni}`);
    spremembe++;
  };

  if (nast.jsonLdUrl) urejaj("json-ld url");
  urejaj("og:url");
  urejaj("canonical");

  console.log(`\n${ime}`);
  console.log(vrstice.join("\n"));
  if (b !== izvorni) {
    if (zastavica("zapisi")) { fs.writeFileSync(pot_dat, b, "utf-8"); console.log("  ZAPISANO"); }
    else console.log("  (suho — brez --zapisi datoteka ostala nespremenjena)");
  } else console.log("  (brez sprememb — že piše to, kar zahteva ukaz)");
}

if (izpusten) {
  console.error(`\nNI KONČANO: ${izpusten} mest ni bilo najdenih — skripta ne ugiba in ni pisala.`);
  process.exit(1);
}
console.log(`\nspremenjenih mest: ${spremembe}`
  + (zastavica("zapisi") ? " (zapisano v datoteki)" : " — suhi pregled, pisano ni bilo nič"));
console.log("Potem zaženi vrata: python rka-deljena-preveri.py  (oba stanja dokazuje rka-deljena-mutacija.py)");
