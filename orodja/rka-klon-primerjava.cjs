const { execFileSync } = require("child_process");
const fs = require("fs");
const crypto = require("crypto");
const REPO = "C:/Users/admin/Downloads/sssdf/rka-onepage";
const KLON = process.env.TEMP + "/rka-klon";
/* Klon je del dokaza, ne predpogoj, ki si ga mora kdo zapomniti: ce ga ni (Temp se
   pocisti), ga orodje naredi samo. Brez tega izpise "razlicnih: VSE" in pade na
   manjkajocem delovnem imeniku — kar izgleda kot okvara repozitorija, je samo
   manjkajoc korak.
   Druga napaka istega izvora: obstojec klon je bil vedno premolcan. Po vsakem
   commitu je primerjal disk s STARIM klonom in javlil razlike, ki jih v repozitoriju
   ni — vrata, ki lazejo obcasno, so slabsa od vrat, ki padejo. Zato se klon pred
   primerjavo vedno pripelje na HEAD vira. */
if (!fs.existsSync(KLON + "/.git")) {
  fs.rmSync(KLON, { recursive: true, force: true });
  execFileSync("git", ["clone", "--quiet", "--no-hardlinks", REPO, KLON], { encoding: "utf8" });
  console.log("klon narejen: " + KLON);
} else {
  execFileSync("git", ["-C", KLON, "fetch", "--quiet", REPO, "HEAD"], { encoding: "utf8" });
  execFileSync("git", ["-C", KLON, "reset", "--hard", "--quiet", "FETCH_HEAD"], { encoding: "utf8" });
  execFileSync("git", ["-C", KLON, "clean", "--quiet", "-fd"], { encoding: "utf8" });
  console.log("klon pripeljan na HEAD: " + KLON);
}
const seznam = execFileSync("git", ["ls-tree", "-r", "--name-only", "HEAD"],
  { cwd: REPO, encoding: "utf8" }).split("\n").filter(Boolean);
const vs = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex").slice(0, 16);
let razlike = [];
for (const f of seznam) {
  let a, b;
  try { a = vs(REPO + "/" + f); } catch (e) { razlike.push(f + "  (na disku ni)"); continue; }
  try { b = vs(KLON + "/" + f); } catch (e) { razlike.push(f + "  (v klonu ni)"); continue; }
  if (a !== b) razlike.push(f + "  disk " + a + "  klon " + b);
}
console.log("preverjenih: " + seznam.length + " | razlicnih: " + razlike.length);
razlike.slice(0, 12).forEach((r) => console.log("  RAZLIKA " + r));
const ignorirane = execFileSync("git", ["status", "--ignored", "--porcelain"],
  { cwd: KLON, encoding: "utf8" }).split("\n").filter((v) => v.startsWith("!!"));
console.log("v klonu ignorirano: " + (ignorirane.join(" ") || "nic"));
console.log(razlike.length === 0 ? "V REDU: klon je bajtsko enak disku na vseh datotekah." : "NI V REDU.");
process.exit(razlike.length === 0 ? 0 : 1);
