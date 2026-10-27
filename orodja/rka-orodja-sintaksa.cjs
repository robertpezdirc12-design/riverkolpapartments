const { spawnSync } = require("child_process");
const fs = require("fs");
const CILJ = process.argv[2] || "C:/Users/admin/Downloads/sssdf/rka-onepage/orodja";
const datoteke = fs.readdirSync(CILJ).sort();
const izvid = [];
let sl = 0;
for (const f of datoteke) {
  if (f === "manifest.json") {
    try { JSON.parse(fs.readFileSync(CILJ + "/" + f, "utf8")); izvid.push("manifest.json  JSON veljaven"); }
    catch (e) { izvid.push("manifest.json  NEVELJAVEN: " + e.message); sl++; }
    continue;
  }
  let preizkus;
  if (f.endsWith(".cjs") || f.endsWith(".js"))
    preizkus = spawnSync("node", ["--check", CILJ + "/" + f], { encoding: "utf8" });
  else if (f.endsWith(".py"))
    preizkus = spawnSync("python", ["-m", "py_compile", CILJ + "/" + f], { encoding: "utf8" });
  else continue;
  if (preizkus.status === 0) izvid.push(f + "  sintaksa OK");
  else { sl++; izvid.push(f + "  SINTAKSA NE: " + (preizkus.stderr || "").split("\n")[0]); }
}
console.log(izvid.filter((v) => v.includes("SINTAKSA NE") || v.includes("NEVELJAVEN")).join("\n") || "vse sintakticno veljavno");
console.log("pregledanih datotek: " + izvid.length + " | sintakticnih napak: " + sl);
process.exit(sl === 0 ? 0 : 1);
