/* Merilo hačka: kolikšno prazno pasovo pusti šumnik nad osnovno črko. Pri
   pravilno risanem č, š, ž se znak dotika črke (pas ~0); če pas meri desetine
   višine črke, je šumnik izmišljen in velika tipografija izgleda razsuta.
   Isti poskus se ponovi za vsako družino, da se ne spori očesa, ampak številke.

  raba: node rka-sumniki-sonda.cjs [druzina ...] */
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DOM = "C:\\Users\\admin\\Downloads\\sssdf\\rka-onepage";
const wait = ms => new Promise(r => setTimeout(r, ms));
const DRUZINE = process.argv.slice(2).length ? process.argv.slice(2)
  : ['"Cormorant Garamond"', 'Georgia', 'serif', '"Manrope"', '"EB Garamond"'];
const VELIKOST = 200;

const s = http.createServer((req, res) => {
  let pot = decodeURIComponent(req.url.split("?")[0]);
  if (pot === "/") pot = "/zgodba.html";
  const datoteka = path.join(DOM, pot);
  if (!datoteka.startsWith(path.resolve(DOM)) || !fs.existsSync(datoteka)) { res.writeHead(404); res.end("ni"); return; }
  const Tip = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".woff2": "font/woff2", ".webp": "image/webp" };
  res.writeHead(200, { "Content-Type": Tip[path.extname(datoteka).toLowerCase()] || "application/octet-stream",
    "Content-Length": String(fs.statSync(datoteka).size), "Cache-Control": "no-store" });
  fs.createReadStream(datoteka).pipe(res);
});
s.listen(0, "127.0.0.1", () => glavnega(s.address().port));

async function glavnega(vrata) {
  const profil = path.join(process.env.TEMP, `cdp-sumniki-${Date.now()}`);
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
    "--force-device-scale-factor=1", "--window-size=1400,900", "--remote-debugging-port=0",
    `--user-data-dir=${profil}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
  try {
    const potVrat = path.join(profil, "DevToolsActivePort");
    let cdpVrata = null;
    for (let i = 0; i < 100 && !cdpVrata; i++) {
      try { const prva = fs.readFileSync(potVrat, "utf-8").split("\n")[0].trim(); if (prva) cdpVrata = Number(prva); }
      catch { await wait(200); }
    }
    if (!cdpVrata) throw new Error("DevToolsActivePort izostaja");
    let v;
    for (let i = 0; i < 50; i++) { try { v = await (await fetch(`http://127.0.0.1:${cdpVrata}/json/version`)).json(); break; } catch { await wait(300); } }
    const ws = new WebSocket(v.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener("open", r));
    let n = 0; const odzivi = new Map();
    const send = (metoda, parametri = {}, sid) => new Promise((res, rej) => {
      const id = ++n; const t = setTimeout(() => { odzivi.delete(id); rej(new Error("rok: " + metoda)); }, 45000);
      odzivi.set(id, { res, rej, t });
      ws.send(JSON.stringify({ id, method: metoda, params: parametri, sessionId: sid }));
    });
    ws.addEventListener("message", ev => {
      const o = JSON.parse(ev.data);
      if (o.id && odzivi.has(o.id)) {
        clearTimeout(odzivi.get(o.id).t); const { res, rej } = odzivi.get(o.id); odzivi.delete(o.id);
        o.error ? rej(new Error(o.error.message)) : res(o.result);
      }
    });
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId: sid } = await send("Target.attachToTarget", { targetId, flatten: true });
    await send("Page.enable", {}, sid);
    await send("Runtime.enable", {}, sid);
    const izvedi = async (izraz, cakaj = false) => {
      const r = await send("Runtime.evaluate", { expression: izraz, returnByValue: true, awaitPromise: cakaj }, sid);
      if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description || r.exceptionDetails.text || "").slice(0, 200));
      return r.result.value;
    };

    await send("Page.navigate", { url: `http://127.0.0.1:${vrata}/zgodba.html?render=1` }, sid);
    for (let i = 0; i < 80; i++) {
      if (await izvedi(`typeof SPOT === 'object' && SPOT !== null`)) break;
      await wait(250);
    }
    await izvedi(`ustavi(); 1`);
    await izvedi(`(async () => { await document.fonts.ready; return 1; })()`, true);

    const rezultat = await izvedi(`(() => {
      /* Vrstice z črnilom: pas praznine med spodnjim grozdom (črka) in zgornjim
         (šumnik) je tisto, kar merimo. Gostota se šteje po vrstici, da šum iz
         antialiasinga ne naredi mostu. */
      function izmeri(druzina, slo, crka, sumnik) {
        const c = document.createElement('canvas'); c.width = 420; c.height = 420;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.clearRect(0, 0, 420, 420);
        x.fillStyle = '#000'; x.font = slo + ' ${VELIKOST}px ' + druzina;
        x.textBaseline = 'alphabetic'; x.fillText(sumnik, 40, 300);
        const d = x.getImageData(0, 0, 420, 420).data;
        const vrste = [];
        for (let y = 0; y < 420; y++) {
          let k = 0;
          for (let px = 0; px < 420; px++) { const a = d[(y * 420 + px) * 4 + 3]; if (a > 40) k++; }
          vrste.push(k);
        }
        const grizde = []; let z = null;
        vrste.forEach((k, y) => { if (k > 0 && z === null) z = y; if (!k && z !== null) { grizde.push([z, y - 1]); z = null; } });
        if (z !== null) grizde.push([z, 419]);
        if (grizde.length < 2) return { druzina, crka, sumnik, grizde: grizde.length, pas: null, delez: null };
        const zgoraj = grizde[0], spodaj = grizde[grizde.length - 1];
        const pas = spodaj[0] - zgoraj[1] - 1;
        const vCrke = spodaj[1] - spodaj[0] + 1;
        return { druzina, crka, sumnik, grizde: grizde.length, pas,
          delez: +(pas / vCrke).toFixed(3), vCrke, vrhZnaka: zgoraj[1] - zgoraj[0] + 1 };
      }
      const izp = [];
      for (const d of ${JSON.stringify(DRUZINE)}) {
        for (const para of [['c', 'č'], ['s', 'š'], ['z', 'ž']]) {
          try { izp.push(izmeri(d, 'italic 300', para[0], para[1])); }
          catch (e) { izp.push({ druzina: d, napaka: e.message }); }
        }
      }
      return izp;
    })()`);
    console.log("družina".padEnd(24), "znak", "grozdov", "pas(px)", "delež višine", "višina črke");
    for (const r of rezultat) {
      if (r.napaka) { console.log(r.druzina, "NAPAKA:", r.napaka); continue; }
      console.log(String(r.druzina).padEnd(24), r.sumnik,
        String(r.grizde).padStart(8),
        String(r.pas === null ? '-' : r.pas).padStart(8),
        String(r.delez === null ? '-' : r.delez).padStart(13),
        String(r.vCrke || '').padStart(12));
    }
  } finally {
    try { const { spawnSync } = require("child_process");
      spawnSync("taskkill", ["/T", "/F", "/PID", String(chrome.pid)], { stdio: "ignore" }); } catch { chrome.kill(); }
    try { fs.rmSync(profil, { recursive: true, force: true }); } catch {}
    s.close();
  }
}

process.on("uncaughtException", e => { console.error("SMRT:", e.message); process.exit(2); });
