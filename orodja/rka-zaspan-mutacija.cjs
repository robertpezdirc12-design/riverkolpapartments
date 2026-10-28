/* FALSIFIKATOR za sondo zaspale opreme.
   Bash-verzija je za tri od štirih mutacij javila "padlih vzorcev = 0", ne da
   bi pokazala, ali je sonda sploh tekla. Števec, ki ne ve razlike med "ni
   padlo" in "ni teklo", ni vrata. Vsaka mutacija tu zato sama dokaže štiri
   stvari: (a) izvirni niz je bil najden, (b) bajti so se res spremenili,
   (c) sonda je vrnila izhod 1 IN svojo lastno POZOR vrstico, (d) obnova je
   byte-enaka izvirniku. Izpis je vedno celoten rep, ne samo izbrani vzorci. */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO = "C:\\Users\\admin\\Downloads\\sssdf\\rka-onepage";
/* Sonde se iščejo ob sami sebi, ne v %TEMP%: ista kopija mora delovati tako v
   začasnem imeniku kot v orodjih, sicer je uvoženi falsifikator lubanj. */
const SONDA = path.join(__dirname, "rka-zaspan-sonda.cjs");
/* Druga sonda meri drugo trditev: prva pove KDAJ se oprema skrije in vrne,
   ta pa ali se ob zmanjšanem gibanju sploh kje giblje. Mutacija H pade samo
   na njej, zato mora falsifikator znati izbrati sondo. */
const SONDA_GIBANJE = path.join(__dirname, "rka-zaspan-gibanje-sonda.cjs");
const DATOTEKE = { "zgodba.js": null, "zgodba.css": null };
let napak = 0, ujetih = 0, skupaj = 0;

const prebberi = () => { for (const f of Object.keys(DATOTEKE)) DATOTEKE[f] = fs.readFileSync(path.join(REPO, f)); };
const obnovi = () => { for (const f of Object.keys(DATOTEKE)) fs.writeFileSync(path.join(REPO, f), DATOTEKE[f]); };

function poroci(ime, pricakovano, izhod, koda) {
  skupaj++;
  const padli = (izhod.match(/POZOR/g) || []).length;
  const teklo = koda !== 2 && !/NI TEKLO/.test(izhod);
  const sorocno = teklo && (pricakovano === 0
    ? (koda === 0 && padli === 0)
    : (koda === 1 && padli >= pricakovano));
  if (!teklo) console.log(`  ${skupaj.toString().padStart(2)}. SPADLO  ${ime} — SONDA NI TEKLA (izhod ${koda}):\n${izhod.trim().split("\n").map(l => "        " + l).join("\n")}`);
  else if (!sorocno) { napak++; console.log(`  ${skupaj.toString().padStart(2)}. SPADLO  ${ime} — padlih=${padli} pricakovano>=${pricakovano} izhod=${koda}`); }
  else { napak += 0; ujetih++; console.log(`  ${skupaj.toString().padStart(2)}. ujeto   ${ime} — padlih=${padli}, izhod=${koda}`); }
  if (teklo && !sorocno) console.log(izhod.split("\n").filter(l => /POZOR|V REDU:/.test(l)).map(l => "        " + l).join("\n"));
  if (!teklo) napak++;
}

/* Vsak tek dobi svoja vrata: prvi falsifikator je tri mutacije pokopal s
   "Chrome se ni zagnal", ker so si zaporedni Chrome-i sedli na ista vrata. */
let vrata = 9440;
const zazeni = (sonda = SONDA) => {
  const r = spawnSync(process.execPath, [sonda, String(++vrata)],
    { encoding: "utf8", cwd: REPO, timeout: 240000 });
  return { izhod: (r.stdout || "") + (r.stderr || ""), koda: r.status, napaka: r.error };
};

/* Mutacija: zamenjaj niz v datoteki, zaženi sondo, obnovi. */
function mutiraj(ime, dat, izvirnik, nadomestilo, pricakovano, sonda = SONDA) {
  const pot = path.join(REPO, dat);
  const vsebina = fs.readFileSync(pot, "utf8");
  if (!vsebina.includes(izvirnik)) {
    skupaj++; napak++;
    console.log(`  ${skupaj.toString().padStart(2)}. SPADLO  ${ime} — MUTACIJA NI NAŠLA IZVIRNIKA v ${dat}`);
    return;
  }
  const nova = vsebina.replace(izvirnik, nadomestilo);
  if (nova === vsebina) {
    skupaj++; napak++;
    console.log(`  ${skupaj.toString().padStart(2)}. SPADLO  ${ime} — bajti se niso spremenili (ni-op mutacija)`);
    return;
  }
  fs.writeFileSync(pot, nova);
  const r = zazeni(sonda);
  obnovi();
  const nazaj = fs.readFileSync(pot, "utf8");
  if (nazaj !== vsebina) { console.log(`  !! ${ime}: OBNOVA NI BYTE-ENAKA — ustavi`); process.exit(2); }
  poroci(ime, pricakovano, r.izhod, r.koda);
}

prebberi();
console.log("=== 0. izhodišče: nespremenjen repozitorij mora pasti na obeh sondah");
let r = zazeni();
if (r.napaka) { console.log("sonda ni tekla: " + r.napaka.message); process.exit(2); }
poroci("izhodišče zeleno (zaspan-sonda)", 0, r.izhod, r.koda);
r = zazeni(SONDA_GIBANJE);
if (r.napaka) { console.log("gibajoča sonda ni tekla: " + r.napaka.message); process.exit(2); }
poroci("izhodišče zeleno (gibanje-sonda)", 0, r.izhod, r.koda);

console.log("=== mutacije, ki morajo pasti");
mutiraj("A mirovanje 999999 ms (nikoli ne zaspi)", "zgodba.js",
  "const OPREMA_MIR = 2500;", "const OPREMA_MIR = 999999;", 2);
/* B naj pade na vzorcu 07 (pavza +3,5 s): brez prikaziOpremo() v ustavi()
   ostane ob pavzi skrita vrstica, ki jo je armiral premik miške pred klikom. */
mutiraj("B pavza ne prikaže opreme", "zgodba.js",
  "  izris(cas);\n  prikaziOpremo();\n}", "  izris(cas);\n}", 1);
mutiraj("C izvozne varovalke ni", "zgodba.js",
  '  if (document.body.classList.contains("render")) return;\n  clearTimeout(oprema_ur);',
  "  clearTimeout(oprema_ur);", 1);
mutiraj("D CSS pravila za zdrs ni", "zgodba.css",
  "body.oprema-skriti .transport,body.oprema-skriti .tipka{opacity:0;transform:translateY(16px)}",
  "", 2);
mutiraj("E fokus ne razkrije skrite vrstice", "zgodba.css",
  "body.oprema-skriti .transport:focus-within{opacity:1;transform:none;pointer-events:auto}",
  "", 1);
mutiraj("G fokus razkrije transport, a ne naslovne vrstice", "zgodba.css",
  "body.oprema-skriti .transport:focus-within ~ .tipka{opacity:1;transform:none}",
  "", 1);
mutiraj("F kazalec ostane skrit tudi ob pavzi (varovalka obrnjena)", "zgodba.js",
  "  if (predvaja)\n    oprema_ur = setTimeout", "  if (true)\n    oprema_ur = setTimeout", 1);
/* H pade samo na gibajoči sondi: navadna sonda vzorči šele po koncu prehoda,
   zato 400 ms in .01 ms prehod izgledata enako. Pade na vzorcu, ki meri
   EFektivno trajanje (1 od 4), ne na časovnem vzorcu — slednji v glavi ne ve,
   kdaj se je prehod začel, zato ni razločevalec. */
mutiraj("H zmanjšano gibanje ne ukine prehoda opreme", "zgodba.css",
  ".tp,.gumb,.kader,.transport,.tipka{transition-duration:.01ms !important}",
  ".tp,.gumb,.kader{transition-duration:.01ms !important}", 1, SONDA_GIBANJE);

console.log("\n=== drevo mora biti nespremenjeno");
const git = spawnSync("git", ["status", "--porcelain", "--", "zgodba.js", "zgodba.css"],
  { encoding: "utf8", cwd: REPO });
const vrstice = git.stdout.split("\n").filter(Boolean).sort();
const cisto = vrstice.length === 2 && vrstice.every(l => /^ M zgodba\.(js|css)$/.test(l));
console.log(cisto ? "  v redu: spremenjeni sta samo datoteki, ki ju vrata merita (M, ne indexiran)"
                  : "  SPADLO: git status = " + JSON.stringify(git.stdout));
if (!cisto) napak++;

console.log(`\nujetih: ${skupaj - napak}/${skupaj}`);
process.exit(napak ? 1 : 0);
