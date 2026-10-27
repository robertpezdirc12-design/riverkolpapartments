/* Casovnica hero ozadja. Vrata zatrjujejo, da se ob prižganem YouTube lokalni mp4
   ne prenese. Pred popravkom je treba vedeti, KDAJ se odločitev zlomi: ali play()
   sploh kdaj pokliče, ali ga pokliče prezgodaj. Zato merita dve reči istočasno:
   strežnik beleži čas prvega odziva za posnetek, zanka v brskalniku pa čas, ko je
   body dobil razred "yt". Vrstni red teh dveh števil je odgovor. */
const { spawn, spawnSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const VRATA_STREZNIKA = 4189;
const VRATA_BRUSKALNIKA = 9440;
const wait = ms => new Promise(r => setTimeout(r, ms));

const TIP = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".mp4": "video/mp4", ".webp": "image/webp",
  ".woff2": "font/woff2", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8" };

let t0 = 0;
const zapisi = [];

function streznik(dir, port) {
  const httpSrv = http.createServer((req, res) => {
    let pot = decodeURIComponent(req.url.split("?")[0]);
    if (pot === "/") pot = "/index.html";
    const datoteka = path.join(dir, pot);
    if (!datoteka.startsWith(path.resolve(dir)) || !fs.existsSync(datoteka)) {
      res.writeHead(404); res.end("ni"); return;
    }
    const veljavna = fs.statSync(datoteka);
    const glave = { "Content-Type": TIP[path.extname(datoteka).toLowerCase()] || "application/octet-stream",
      "Accept-Ranges": "bytes", "Content-Length": String(veljavna.size) };
    const obseg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    let zacetek = 0, konec = veljavna.size - 1, kod = 200;
    if (obseg) {
      zacetek = obseg[1] ? +obseg[1] : 0;
      if (obseg[2]) konec = +obseg[2];
      if (obseg[1] && !obseg[2]) konec = veljavna.size - 1;
      if (zacetek > konec || konec >= veljavna.size) {
        res.writeHead(416, { "Content-Range": `bytes */${veljavna.size}` }); res.end(); return;
      }
      kod = 206;
      glave["Content-Range"] = `bytes ${zacetek}-${konec}/${veljavna.size}`;
      glave["Content-Length"] = String(konec - zacetek + 1);
    }
    const jePosnetek = pot.endsWith("kolpa-ozadje.mp4");
    if (jePosnetek) zapisi.push({ ms: Date.now() - t0, dogodek: "strežnik: prvi povzetek za mp4" });
    res.writeHead(kod, glave);
    const tok = fs.createReadStream(datoteka, { start: zacetek, end: konec });
    tok.pipe(res);
  });
  return new Promise(res => httpSrv.listen(port, "127.0.0.1", () => res(httpSrv)));
}

const CISTI = [];
process.on("uncaughtException", e => {
  console.error("IZJEMA:", e.message);
  for (const f of CISTI) { try { f(); } catch {} }
  process.exit(2);
});

const SRONDA = `(() => ({
  yt: document.body.classList.contains('yt'),
  iframe: !!(document.querySelector('#bg-yt iframe')),
  cas: +(document.getElementById('bg').currentTime || 0).toFixed(2),
  igra: !document.getElementById('bg').paused
}))()`;

(async () => {
  const srv = await streznik("C:\\Users\\admin\\Downloads\\sssdf\\rka-onepage", VRATA_STREZNIKA);
  CISTI.push(() => srv.close());
  const profil = `cdp-ozadje-cas-${Date.now()}`;
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--mute-audio", "--window-size=1440,900", `--remote-debugging-port=${VRATA_BRUSKALNIKA}`,
    `--user-data-dir=${process.env.TEMP}\\${profil}`, "--no-first-run", "about:blank"],
    { stdio: "ignore" });
  CISTI.push(() => {
    try { spawnSync("taskkill", ["/T", "/F", "/PID", String(chrome.pid)], { stdio: "ignore" }); }
    catch { chrome.kill(); }
  });
  let v;
  for (let i = 0; i < 50; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${VRATA_BRUSKALNIKA}/json/version`)).json(); break; }
    catch { await wait(400); }
  }
  if (!v) throw new Error("Chrome se ni zagnal");
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  CISTI.push(() => { try { ws.close(); } catch {} });
  let n = 0; const p = new Map(); const dog = new Map();
  const send = (m, pr = {}, sid) => new Promise((res, rej) => {
    const id = ++n; const t = setTimeout(() => { p.delete(id); rej(new Error("čas: " + m)); }, 30000);
    p.set(id, { res, rej, t });
    ws.send(JSON.stringify({ id, method: m, params: pr, sessionId: sid }));
  });
  ws.addEventListener("message", ev => {
    const o = JSON.parse(ev.data);
    if (o.id && p.has(o.id)) {
      clearTimeout(p.get(o.id).t);
      const { res, rej } = p.get(o.id); p.delete(o.id);
      o.error ? rej(new Error(o.error.message)) : res(o.result);
    } else if (o.method) {
      const k = (o.sessionId || "") + "|" + o.method;
      dog.set(k, (dog.get(k) || 0) + 1);
    }
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: sid } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sid);
  await send("Runtime.enable", {}, sid);
  await send("Emulation.setDeviceMetricsOverride",
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sid);

  t0 = Date.now();
  await send("Page.navigate", { url: `http://127.0.0.1:${VRATA_STREZNIKA}/index.html` }, sid);
  let prviYT = null, prvaIgra = null;
  for (let i = 0; i < 120; i++) {
    const r = await send("Runtime.evaluate", { expression: SRONDA, returnByValue: true }, sid);
    const z = r.result && r.result.value;
    if (z) {
      if (z.yt && prviYT === null) {
        prviYT = Date.now() - t0;
        zapisi.push({ ms: prviYT, dogodek: `brskalnik: body je dobil razred "yt" (mp4 cas ${z.cas}s)` });
      }
      if (z.igra && prvaIgra === null) {
        prvaIgra = Date.now() - t0;
        zapisi.push({ ms: prvaIgra, dogodek: `brskalnik: lokalni mp4 se vrti (cas ${z.cas}s)` });
      }
    }
    if (prviYT && prvaIgra) break;
    await wait(200);
  }
  await wait(1500);
  const koncno = await send("Runtime.evaluate", { expression: SRONDA, returnByValue: true }, sid);
  zapisi.sort((a, b) => a.ms - b.ms);
  console.log("casovnica (ms od navigacije):");
  for (const z of zapisi) console.log(`  ${String(z.ms).padStart(6)} ms  ${z.dogodek}`);
  if (!zapisi.some(z => z.dogodek.startsWith("strežnik")))
    console.log("     —     strežnik ni nikoli dobil povzetka za mp4");
  console.log("\nkonec stanja:", JSON.stringify(koncno.result.value));
  await send("Target.closeTarget", { targetId }, sid).catch(() => {});
  console.log(prviYT === null ? "YT NI STEKEL" : `YouTube pri ${prviYT} ms`);
})().catch(e => { console.error("SMRT:", e.message); process.exitCode = 2; })
  .finally(() => {
    for (const f of CISTI) { try { f(); } catch {} }
    setTimeout(() => process.exit(process.exitCode || 0), 300);
  });
