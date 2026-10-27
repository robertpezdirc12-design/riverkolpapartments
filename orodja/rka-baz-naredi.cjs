/* Izhodiščni pas vrat rka-ozadje-proveri.cjs sme biti KODO, ki ga opisuje:
   lokalni posnetek se prenese takoj, ne glede na to, ali YouTube steče.
   25. 10. se je mapa rka-baz osvežila s kopijo že popravljenega koda in je
   bazni pas oddal 0 KB, kar je A/B primerjavo napravilo lažno rdečo. Ta
   zapisovalec zato izdelano stran kopira in nato zavrne samo tisto vrstico,
   ki jo popravek sploh nosi. */
const fs = require("node:fs");
const path = require("node:path");

const IZVOR = "C:\\Users\\admin\\Downloads\\sssdf\\rka-onepage";
const CILJ = process.env.TEMP + "\\rka-baz";

const NAPAKA = "  if (!youtube && (ytManjka || !ytPlast)) bg.play().catch(() => {});";
const STARO = "  if (!youtube) bg.play().catch(() => {});";

function kopiraj(iz, v) {
  for (const ime of fs.readdirSync(iz)) {
    if (ime === "izvozi" || ime.endsWith(".log")) continue;
    const a = path.join(iz, ime), b = path.join(v, ime);
    if (fs.statSync(a).isDirectory()) { fs.mkdirSync(b, { recursive: true }); kopiraj(a, b); }
    else fs.copyFileSync(a, b);
  }
}

/* Mapa je včasih zaklenjena (prejšnji zagon vrat pusti strežnik, ki jo drži),
   zato izbris ni pogoj: brez njega se datoteke prepišejo na mestu. */
try { fs.rmSync(CILJ, { recursive: true, force: true }); }
catch (e) { console.log(`opozorilo: ${CILJ} se ni dalo izbrisati (${e.code}), gradim na mestu`); }
fs.mkdirSync(CILJ, { recursive: true });
kopiraj(IZVOR, CILJ);

const pot = path.join(CILJ, "app.js");
const besedilo = fs.readFileSync(pot, "utf8");
if (!besedilo.includes(NAPAKA)) {
  console.error("SMRT: v izviru ni več vrstice, ki jo izhodišče mora zavrniti; " +
                "izhodiščni pas ne pomeni več ničesar.");
  process.exit(2);
}
fs.writeFileSync(pot, besedilo.replace(NAPAKA, STARO));

const preverjeno = fs.readFileSync(pot, "utf8");
console.log(`izhodišče zgrajeno v ${CILJ}`);
console.log(`  zavrnjena vrstica: ${preverjeno.includes(STARO) ? "da" : "NE"} · ` +
            `pogoj ytManjka v njej: ${preverjeno.includes(NAPAKA) ? "JE ŠE (napaka)" : "ni ga več"}`);
