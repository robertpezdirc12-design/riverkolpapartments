/* Sondata, ne vrata: pove, kaj se na strani zgodbe dejansko zgodi, kadar jo
   merim pri 1080x1920. Meri računske vrednosti, ne pričakovanj — šele ko poznam
   številke, se odlocim, katere tokene moram preklopiti. */
const { spawn, spawnSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DOM = "C:\\Users\\admin\\Downloads\\sssdf\\rka-onepage";
const wait = ms => new Promise(r => setTimeout(r, ms));

const TIP = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4", ".webp": "image/webp", ".jpg": "image/jpeg",
  ".vtt": "text/vtt; charset=utf-8", ".m4a": "audio/mp4", ".png": "image/png" };

function streznik(dir) {
  const s = http.createServer((req, res) => {
    let pot = decodeURIComponent(req.url.split("?")[0]);
    if (pot === "/") pot = "/zgodba.html";
    const datoteka = path.join(dir, pot);
    if (!datoteka.startsWith(path.resolve(dir)) || !fs.existsSync(datoteka)) {
      res.writeHead(404); res.end("ni"); return;
    }
    res.writeHead(200, { "Content-Type": TIP[path.extname(datoteka).toLowerCase()] || "application/octet-stream",
      "Content-Length": String(fs.statSync(datoteka).size), "Cache-Control": "no-store" });
    fs.createReadStream(datoteka).pipe(res);
  });
  return new Promise(r => s.listen(0, "127.0.0.1", () => r({ vrata: s.address().port, zapri: () => new Promise(x => s.close(x)) })));
}

const CISTI = [];
async function zazeni(port, sirina, visina) {
  const profil = path.join(process.env.TEMP, `cdp-sonda-${Date.now()}`);
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--mute-audio", "--autoplay-policy=no-user-gesture-required", "--force-device-scale-factor=1",
    `--window-size=${sirina},${visina}`, "--remote-debugging-port=0",
    `--user-data-dir=${profil}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
  CISTI.push(() => { try { spawnSync("taskkill", ["/T", "/F", "/PID", String(chrome.pid)], { stdio: "ignore" }); } catch { chrome.kill(); } });
  const datoteka = path.join(profil, "DevToolsActivePort");
  let vrata = null;
  for (let i = 0; i < 100 && !vrata; i++) {
    try { const prva = fs.readFileSync(datoteka, "utf-8").split("\n")[0].trim(); if (prva) vrata = Number(prva); }
    catch { await wait(200); }
  }
  if (!vrata) throw new Error("DevToolsActivePort izostaja");
  let v;
  for (let i = 0; i < 50; i++) { try { v = await (await fetch(`http://127.0.0.1:${vrata}/json/version`)).json(); break; } catch { await wait(300); } }
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  CISTI.push(() => { try { ws.close(); } catch {} });
  let n = 0; const odzivi = new Map(); const dog = new Map();
  const send = (metoda, parametri = {}, sid) => new Promise((res, rej) => {
    const id = ++n; const t = setTimeout(() => { odzivi.delete(id); rej(new Error("rok: " + metoda)); }, 30000);
    odzivi.set(id, { res, rej, t });
    ws.send(JSON.stringify({ id, method: metoda, params: parametri, sessionId: sid }));
  });
  ws.addEventListener("message", ev => {
    const o = JSON.parse(ev.data);
    if (o.id && odzivi.has(o.id)) { clearTimeout(odzivi.get(o.id).t); const { res, rej } = odzivi.get(o.id); odzivi.delete(o.id); o.error ? rej(new Error(o.error.message)) : res(o.result); }
    else if (o.method) { const k = (o.sessionId || "") + "|" + o.method; dog.set(k, (dog.get(k) || 0) + 1); }
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: sid } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sid);
  await send("Runtime.enable", {}, sid);
  await send("Emulation.setDeviceMetricsOverride", { width: sirina, height: visina, deviceScaleFactor: 1, mobile: false }, sid);
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/zgodba.html` }, sid);
  const t0 = Date.now();
  while (Date.now() < t0 + 20000 && !(dog.get(sid + "|Page.loadEventFired") > 0)) await wait(120);
  for (let i = 0; i < 60; i++) {
    const r = await send("Runtime.evaluate", { expression: `typeof SPOT === 'object' && SPOT !== null && seznam.length > 0`, returnByValue: true }, sid);
    if (r.result && r.result.value) break;
    await wait(200);
  }
  return { send, sid };
}

async function izmeri(send, sid, izraz) {
  const r = await send("Runtime.evaluate", { expression: `(() => ${izraz})()`, returnByValue: true, awaitPromise: false }, sid);
  if (r.exceptionDetails) throw new Error("izraz: " + (r.exceptionDetails.exception?.description || "").slice(0, 200));
  return r.result.value;
}

const SONDA = (t) => `{
  izris(${t});
  const rac = getComputedStyle(document.documentElement);
  const el = (k) => document.querySelector(k);
  const bbox = (k) => { const e = el(k); if (!e) return null; const r = e.getBoundingClientRect();
    return { levi: +r.left.toFixed(1), desni: +r.right.toFixed(1), zgoraj: +r.top.toFixed(1), spodaj: +r.bottom.toFixed(1), visina: +r.height.toFixed(1) }; };
  const naslovi = Array.from(document.querySelectorAll('.napis.vidno .n-naslov')).map(e => ({
    size: +parseFloat(getComputedStyle(e).fontSize).toFixed(1),
    vrstice: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight || getComputedStyle(e).fontSize)),
    bbox: (() => { const r = e.getBoundingClientRect(); return { zgoraj: +r.top.toFixed(1), spodaj: +r.bottom.toFixed(1), sirina: +r.width.toFixed(1) }; })()
  }));
  return {
    okno: { sirina: innerWidth, visina: innerHeight },
    token: { naslov: rac.getPropertyValue('--t-naslov').trim(), robT: rac.getPropertyValue('--rob-t').trim(),
             robS: rac.getPropertyValue('--rob-s').trim(), robX: rac.getPropertyValue('--rob-x').trim() },
    racUni: parseFloat(getComputedStyle(document.body).fontSize),
    naslisi: bbox('.napisi'), transport: bbox('.transport'), tipka: bbox('.tipka'),
    naslovi,
    preplava: (() => { let n = 0; const primeri = [];
      for (const e of document.querySelectorAll('.napisi *, .transport *')) {
        const r = e.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.right > innerWidth + 0.6 || r.left < -0.6 || r.bottom > innerHeight + 0.6 || r.top < -0.6) { n++; if (primeri.length < 3) primeri.push(e.className + ' ' + JSON.stringify({ l: +r.left.toFixed(0), d: +r.right.toFixed(0), z: +r.top.toFixed(0), s: +r.bottom.toFixed(0) })); }
      } return { n, primeri }; })(),
    preval: Array.from(document.querySelectorAll('.napis.vidno')).map(e => ({ sid: e.className, visina: +e.getBoundingClientRect().height.toFixed(1) }))
  };
}`;

(async () => {
  const srv = await streznik(DOM);
  /* Brez tega se dogodek zanke ne izprazni nikoli: sonda izpiše zadnjo vrstico,
     proces pa ostane živ in zablokira verigo portalov, ki jo kliče. */
  CISTI.push(() => { srv.zapri(); });
  for (const [ime, sirina, visina] of [["16x9", 1920, 1080], ["9x16", 1080, 1920]]) {
    const { send, sid } = await zazeni(srv.vrata, sirina, visina);
    console.log(`\n===== ${ime} @ ${sirina}x${visina} =====`);
    for (const t of [0.5, 2.0, 8.0, 20.0, 34.0, 48.0, 59.0]) {
      const m = await izmeri(send, sid, SONDA(t));
      const nas = m.naslovi[0] || {};
      const zaleze = m.naslisi && m.transport ? +(m.transport.zgoraj - m.naslisi.spodaj).toFixed(1) : null;
      console.log(`t=${String(t).padStart(5)}  okno=${m.okno.sirina}x${m.okno.visina}  naslov=${nas.size ?? "-"}px  vrstic=${nas.vrstice ?? "-"}  ` +
        `pas=[${m.naslisi?.zgoraj}..${m.naslisi?.spodaj}]  transport.zgoraj=${m.transport?.zgoraj}  zaleze=${zaleze}  ` +
        `preplava=${m.preplava.n}  robT=${m.token.robT} robS=${m.token.robS}`);
      if (m.preplava.n) console.log("          preplava: " + m.preplava.primeri.join(" | "));
    }
    const zad = await izmeri(send, sid, SONDA(59));
    console.log("  naslovi zadnjega kadra: " + JSON.stringify(zad.naslovi));
    console.log("  prevzeti robovi: " + JSON.stringify(zad.preval));
  }
  console.log("\n(sonda ne razsodi — samo meri.)");
})().catch(e => { console.error("SMRT:", e.message); process.exitCode = 2; })
  .finally(() => { for (const f of CISTI) { try { f(); } catch {} } });
