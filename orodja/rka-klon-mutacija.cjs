const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const KLON = process.env.TEMP + "/rka-klon";
const f = "zvok/60-sl/seznam.json";
const pot = KLON + "/" + f;
let izvod = "";
const zazeni = () => {
  const r = spawnSync("node", [process.env.TEMP + "/rka-klon-primerjava.cjs"], { encoding: "utf8" });
  return r.stdout.trim().split("\n")[0] + " | zadnja vrstica: " + r.stdout.trim().split("\n").pop() + " | IZHOD=" + r.status;
};
const original = fs.readFileSync(pot);
fs.writeFileSync(pot, Buffer.from(original.toString("latin1").replace(/\r/g, "")));
izvod += "po mutaciji:   " + zazeni() + "\n";
execFileSync("git", ["checkout", "--", f], { cwd: KLON });
izvod += "po obnovitvi: " + zazeni() + "\n";
izvod += "obnovljeno bajtsko enako izvirniku: " + (fs.readFileSync(pot).equals(original) ? "DA" : "NE") + "\n";
process.stdout.write(izvod);
