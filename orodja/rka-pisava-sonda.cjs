/* Sonda pisave: ali šumnik res nariše lokalno hranjena pisava ali pade na
   rezervno? Merilo je par širin: enaka kot pri pisavi, ki ne obstaja, pomeni
   rezervo. Ni vrata — je meritev, ki pove, iz katere datoteke se izriše. */
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DOM = "C:\\Users\\admin\\Downloads\\sssdf\\rka-onepage";
const wait = ms => new Promise(r => setTimeout(r, ms));
const ZNAKI = "čćšžČĆŠŽđ";
const ZAHTEVKI = [];

const s = http.createServer((req, res) => {
  let pot = decodeURIComponent(req.url.split("?")[0]);
  ZAHTEVKI.push(pot);
  if (pot === "/") pot = "/zgodba.html";
  const datoteka = path.join(DOM, pot);
  if (!datoteka.startsWith(path.resolve(DOM)) || !fs.existsSync(datoteka)) { res.writeHead(404); res.end("ni"); return; }
  const Tip = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".mp4": "video/mp4", ".webp": "image/webp", ".woff2": "font/woff2", ".vtt": "text/vtt; charset=utf-8" };
  res.writeHead(200, { "Content-Type": Tip[path.extname(datoteka).toLowerCase()] || "application/octet-stream",
    "Content-Length": String(fs.statSync(datoteka).size), "Cache-Control": "no-store" });
  fs.createReadStream(datoteka).pipe(res);
});
s.listen(0, "127.0.0.1", () => glavnega(s.address().port));

async function glavnega(vrata) {
  const profil = path.join(process.env.TEMP, `cdp-pisava-${Date.now()}`);
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
    "--force-device-scale-factor=1", "--window-size=1080,1920", "--remote-debugging-port=0",
    `--user-data-dir=${profil}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
  try {
    const datoteka = path.join(profil, "DevToolsActivePort");
    let cdpVrata = null;
    for (let i = 0; i < 100 && !cdpVrata; i++) {
      try { const prva = fs.readFileSync(datoteka, "utf-8").split("\n")[0].trim(); if (prva) cdpVrata = Number(prva); }
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
      if (await izvedi(`typeof SPOT === 'object' && SPOT !== null && seznam.length > 0`)) break;
      await wait(250);
    }
    await izvedi(`ustavi(); 1`);
    await izvedi(`(async () => { await document.fonts.ready; return 1; })()`, true);

    const pred = await izvedi(`(() => {
      const meri = (druzina, slo) => { const c = document.createElement('canvas').getContext('2d');
        c.font = slo + ' ' + druzina; return c.measureText(${JSON.stringify(ZNAKI)}).width; };
      const ladi = {}; document.fonts.forEach(f => { ladi[f.family + ' ' + f.style + ' ' + f.weight] = f.status; });
      return { check: document.fonts.check('italic 300 78px "Cormorant Garamond"', ${JSON.stringify(ZNAKI)}),
        checkNavadno: document.fonts.check('300 78px "Cormorant Garamond"', ${JSON.stringify(ZNAKI)}),
        checkManrope: document.fonts.check('700 20px Manrope', ${JSON.stringify(ZNAKI)}),
        sirinaKormorant: meri('"Cormorant Garamond"', 'italic 300 78px'),
        sirinaRezerva: meri('NonexistentFace-ZZ', 'italic 300 78px'),
        sirinaGeorgia: meri('Georgia', 'italic 300 78px'),
        ladi, nalozenih: document.fonts.size };
    })()`);
    console.log("pred vidnim napisom:", JSON.stringify(pred, null, 1));

    /* Šele zdaj gre besedilo na platno — ako latin-ext sploh ni bil potreben,
       se mora šele tukaj pokazati v omrežju in v širinah. */
    await izvedi(`izris(54); 1`);
    await wait(1500);
    const po = await izvedi(`(() => {
      const el = document.querySelector('.napis.vidno .n-naslov');
      const rac = el ? getComputedStyle(el) : null;
      const c = document.createElement('canvas').getContext('2d');
      c.font = rac ? rac.font : 'italic 300 78px serif';
      return { besedilo: el ? el.textContent : null, font: rac ? rac.font : null,
        sirinaVGradniku: c.measureText(el ? el.textContent : '').width,
        check: document.fonts.check('italic 300 78px "Cormorant Garamond"', ${JSON.stringify(ZNAKI)}) };
    })()`);
    console.log("po izrisu:", JSON.stringify(po));
    /* Besedilo lahko vmeva več družin: CDP pove, katera je bila dejansko
       uporabljena za ta vozel. Če je tu druga kot Cormorant, haček ne pride iz
       pisave, ampak iz rezerve — in je velika tipografija pokvarjena. */
    await send("DOM.enable", {}, sid);
    await send("CSS.enable", {}, sid);
    const { root } = await send("DOM.getDocument", { depth: -1 }, sid);
    const { nodeId } = await send("DOM.querySelector",
      { nodeId: root.nodeId, selector: ".napis.vidno .n-naslov" }, sid);
    if (!nodeId) console.log("NAPIS NI NA VOLJO — razsodbe o pisavi ni");
    else {
      const { fonts } = await send("CSS.getPlatformFontsForNode", { nodeId }, sid);
      console.log("dejanske pisave vozla:", JSON.stringify(fonts));
    }
    console.log("zahtevane datoteke:", ZAHTEVKI.filter(z => z.endsWith(".woff2")).join("  ") || "NIC");
  } finally {
    try { const { spawnSync } = require("child_process");
      spawnSync("taskkill", ["/T", "/F", "/PID", String(chrome.pid)], { stdio: "ignore" }); } catch { chrome.kill(); }
    try { fs.rmSync(profil, { recursive: true, force: true }); } catch {}
    s.close();
  }
}

process.on("uncaughtException", e => { console.error("SMRT:", e.message); process.exit(2); });
