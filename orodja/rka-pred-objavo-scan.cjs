const { execFileSync } = require("child_process");
const fs = require("fs");
const REPO = process.argv[2] || "C:/Users/admin/Downloads/sssdf/rka-onepage";
const sez = execFileSync("git", ["ls-files"], { cwd: REPO, encoding: "utf8" }).split("\n").filter(Boolean);
const vzorci = [
  ["ghp_", /ghp_[A-Za-z0-9]{20,}/],
  ["github_pat", /github_pat_[A-Za-z0-9_]{20,}/],
  ["private key", /BEGIN (RSA|OPENSSH|EC|DSA|PGP) PRIVATE KEY/],
  ["AWS", /(AKIA|ASIA)[0-9A-Z]{12,16}/],
  ["Bearer token", /Bearer\s+[A-Za-z0-9._-]{30,}/],
  ["apiKey dodelana", /api[_-]?["']?key["']?\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i],
  ["Lozenka dodelana", /(password|passwd|geslo|lozinka)\s*[:=]\s*["'][^"']{6,}["']/i],
  ["Cookie sloz", /Cookie:\s*[A-Za-z0-9%_=;. -]{40,}/]
];
const zadetki = [];
const besedilo = new Set([".html", ".css", ".js", ".cjs", ".mjs", ".json", ".vtt", ".txt", ".md", ".ps1", ".py"]);
let najvecji = { pot: "", bajti: 0 }, skupaj = 0;
for (const f of sez) {
  const b = fs.readFileSync(REPO + "/" + f);
  skupaj += b.length;
  if (b.length > najvecji.bajti) najvecji = { pot: f, bajti: b.length };
  if (!besedilo.has(f.slice(f.lastIndexOf(".")))) continue;
  const s = b.toString("utf8");
  for (const [ime, rx] of vzorci) {
    const m = s.match(rx);
    if (m) zadetki.push(f + "  " + ime + "  (" + m[0].slice(0, 8) + "…)");
  }
}
console.log("pregledanih datotek: " + sez.length + " | skupaj " + (skupaj / 1048576).toFixed(1) + " MB");
console.log("najvecja datoteka: " + najvecji.pot + "  " + (najvecji.bajti / 1048576).toFixed(2) + " MB");
console.log("skrinjenih vzorcev: " + vzorci.length + " | zadetkov: " + zadetki.length);
zadetki.forEach((z) => console.log("  ZADETEK " + z));
console.log(zadetki.length === 0 ? "V REDU: v najavljenem drevesu ni skrinjenih vrednosti." : "NI V REDU: ne objavljati.");
process.exit(zadetki.length === 0 ? 0 : 1);
