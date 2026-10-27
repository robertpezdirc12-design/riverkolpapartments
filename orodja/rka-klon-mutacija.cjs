const { spawnSync } = require("child_process");
const fs = require("fs");
const REPO = "C:/Users/admin/Downloads/sssdf/rka-onepage";
const f = "zvok/60-sl/seznam.json";
const pot = REPO + "/" + f;
/* Mutacija mora zasci to, kar trditev sploh primerja: delovno kopijo na disku.
   Prejsnja razlicica je muarila klon. Po popravku primerjave, ki klon pred
   primerjavo resetne na HEAD vira, bi tak poseg bil nicelni — vrata bi ga
   popravila, preden bi ga sploh videla. Nicelna mutacija je hudsja od padca:
   vzdrzi lazno trditev o vratah.
   Druga napaka prejsnje razlicice: javljala je absolutno stevilo razlik, ki je
   na umazanem delovnem drevesu vedno vecje od nicelne in torej ni nic dokazala.
   Zato zdaj meri PRIRAST glede na izhodisce in zahteva, da je med razlikami
   prav ta datoteka. */
const zazenj = () => {
  const r = spawnSync("node", [process.env.TEMP + "/rka-klon-primerjava.cjs"], { encoding: "utf8" });
  const vrste = r.stdout.split("\n").map((v) => v.trim()).filter(Boolean);
  const n = Number((vrste.find((v) => v.startsWith("preverjenih:")) || "").match(/razlicnih:\s*(\d+)/)?.[1]);
  const razlike = vrste.filter((v) => v.startsWith("RAZLIKA")).map((v) => v.replace(/^RAZLIKA\s+/, "").split(/\s{2}/)[0]);
  return { n, razlike, izhod: r.status, zadnja: vrste[vrste.length - 1] || "" };
};
const original = fs.readFileSync(pot);
const izh = zazenj();
fs.writeFileSync(pot, Buffer.from(original.toString("latin1").replace(/\r/g, "")));
const po = zazenj();
fs.writeFileSync(pot, original);
const ob = zazenj();
const enako = fs.readFileSync(pot).equals(original);
const pogoji = [
  ["mutacija dodaja natanko eno razliko", po.n === izh.n + 1],
  ["prava datoteka je med razlikami", po.razlike.includes(f)],
  ["po obnovitvi ni vec razlike te datoteke", !ob.razlike.includes(f)],
  ["po obnovitvi je stanje enako izhodoscu", ob.n === izh.n],
  ["izvirnik bitno enak", enako],
  ["mutacija vrne izhod 1", po.izhod === 1],
  ["obnovitev vrne izhod kot izhodesce", ob.izhod === izh.izhod],
];
console.log("izhodosce:        razlicnih " + izh.n + " | izhod " + izh.izhod);
console.log("po mutaciji:      razlicnih " + po.n + " | izhod " + po.izhod + " | " + po.razlike.join(", "));
console.log("po obnovitvi:     razlicnih " + ob.n + " | izhod " + ob.izhod);
pogoji.forEach(([ime, res]) => console.log((res ? "  OK   " : "  PAD  ") + ime));
const slabi = pogoji.filter(([, res]) => !res).length;
console.log("morilo pasti: 1 | padlo: " + (po.izhod === 1 ? 1 : 0) + " | pogojev: " + pogoji.length + " | slabsih: " + slabi);
console.log(slabi === 0 ? "V REDU: falsifikator je videti in pocisti sled." : "NI V REDU: dokaz o klonu ni falsificiran.");
process.exit(slabi === 0 ? 0 : 1);
