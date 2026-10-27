/* Postreze mapo rka-reklama z byte-range podporo, da predvajalnik ne zastane.
   Pot je zapisana s poševnicami: Node jih razume enako kot obratne, prihrani pa
   se podvajanje, ki ga zahteva zapis poti v JS-nizi. */
const { zzeni } = require("./rka-streznik.cjs");

const MAPA = "C:/Users/admin/Downloads/sssdf/rka-reklama";
const VRATA = Number(process.argv[2] || 4185);

zzeni(MAPA, VRATA)
  .then(() => console.log(`postrezeno na http://127.0.0.1:${VRATA}/predogled.html`))
  .catch(e => { console.log("ZASTAL: " + e.message); process.exit(1); });
