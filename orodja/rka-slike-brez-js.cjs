/* Posnetki zaslona za vizualno presojo: ista meritev pogleda kot v sondei
   (Emulation.setDeviceMetricsOverride, ne --window-size), s počakano dekodirano
   sliko in domervo. Dodan je še pogled BREZ JavaScripta, ker ga sonda ne more
   videti — tam odloča <noscript>, ki ga vbrizga brskalnik, ne koda. */
const { spawn } = require("child_process");
const fs = require("fs");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9427, wait = ms => new Promise(r => setTimeout(r, ms));
const IZHOD = process.env.TEMP + "\\rka-slike";
const DOM = "http://127.0.0.1:4183";

/* brez-js = uprankanje izvajanja skript prek CDP: pravi test, ali strani
   stojita sami brez app.js, ne simulacija z izklopom značk. */
const PRIMERI = [
  { ime: "zgodba-320",        url: `${DOM}/zgodba.html`,     w: 320,  h: 640, dpr: 2, mobil: true,  js: true },
  { ime: "zgodba-1440",       url: `${DOM}/zgodba.html`,     w: 1440, h: 900, dpr: 1, mobil: false, js: true },
  { ime: "termini-320",       url: `${DOM}/index.html#termini`, w: 320,  h: 640, dpr: 2, mobil: true,  js: true },
  { ime: "termini-1440",      url: `${DOM}/index.html#termini`, w: 1440, h: 900, dpr: 1, mobil: false, js: true },
  { ime: "domov-320",         url: `${DOM}/index.html#domov`,   w: 320,  h: 640, dpr: 2, mobil: true,  js: true },
  { ime: "domov-320-brez-js", url: `${DOM}/index.html`,      w: 320,  h: 640, dpr: 2, mobil: true,  js: false },
  { ime: "domov-1440-brez-js",url: `${DOM}/index.html`,      w: 1440, h: 900, dpr: 1, mobil: false, js: false },
  { ime: "zgodba-320-brez-js",url: `${DOM}/zgodba.html`,     w: 320,  h: 640, dpr: 2, mobil: true,  js: false },
];

fs.mkdirSync(IZHOD, { recursive: true });

(async () => {
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}\\cdp-js-${Date.now()}`,
    "--no-first-run", "--window-size=1500,1000", "about:blank"], { stdio: "ignore" });
  let v;
  for (let i = 0; i < 60; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await wait(300); }
  }
  if (!v) throw new Error("Chrome se ni oglasil na CDP vratih");
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  let n = 0; const p = new Map();
  const send = (m, pr = {}, sid) => new Promise((res, rej) => {
    const id = ++n; p.set(id, { res, rej });
    ws.send(JSON.stringify(sid ? { id, method: m, params: pr, sessionId: sid } : { id, method: m, params: pr }));
  });
  ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id);
      m.error ? q.rej(new Error(JSON.stringify(m.error))) : q.res(m.result); }
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const sess = (m, pr = {}) => send(m, pr, sessionId);
  const ev = async ex => {
    const r = await sess("Runtime.evaluate", { expression: ex, returnByValue: true });
    if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description || r.exceptionDetails));
    return r.result.value;
  };
  /* Promise mora biti POČAKAN: sicer vrne serializiran prazen objekt in
     mislimo, da so pisave naložene, ko še niso. */
  const evAwait = async ex => {
    const r = await sess("Runtime.evaluate", { expression: ex, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description || r.exceptionDetails));
    return r.result.value;
  };
  await sess("Page.enable"); await sess("Runtime.enable");

  for (const c of PRIMERI) {
    /* Izklop skript mora BITI postavljen pred navigacijo; po njo je prepozno,
       app.js se je že iztekel. Zato vsak primer začne na novo strani. */
    await sess("Emulation.setScriptExecutionDisabled", { value: !c.js });
    await sess("Emulation.setDeviceMetricsOverride",
      { width: c.w, height: c.h, deviceScaleFactor: c.dpr, mobile: c.mobil });
    await sess("Page.navigate", { url: c.url });
    await wait(c.js ? 3200 : 900);
    if (c.js) {
      /* Šele dokončane pisave in dekodirana poster-slika: sicer bi posnetek
         kazal stanje med prenosem, ne tistega, kar stranka vidi. */
      await evAwait(`document.fonts.ready.then(() => Promise.all(
        [...document.images].filter(i => !i.complete).map(i => i.decode().catch(() => {})))).then(() => 'gotovo')`);
      await wait(400);
    }
    const { data } = await sess("Page.captureScreenshot", { format: "png" });
    const pot = `${IZHOD}\\${c.ime}.png`;
    fs.writeFileSync(pot, Buffer.from(data, "base64"));
    const stanje = await ev(`(() => {
      const s = document.getElementById('stage');
      const shell = document.querySelector('.shell');
      return JSON.stringify({
        drsi: s ? (s.scrollHeight - s.clientHeight) : 'nima',
        shell: shell ? getComputedStyle(shell).display : 'nima',
        bezJs: document.querySelector('.bez-js') ? 'viden' : 'ni',
        /* Razlikovalnik, ali je izklop skript sploh stopil do strani: platno
           napolni šele zgodba.js, brez njega ostane prazno. */
        platno: document.querySelectorAll('#platno > *').length,
        vseh: document.getElementsByTagName('*').length,
        naslov: document.title.slice(0, 30),
        gumbi: [...document.querySelectorAll('a.btn,button')]
          .map(b => b.textContent.trim().replace(/\\s+/g, ' ')).slice(0, 5)
      });
    })()`);
    console.log(`${c.ime.padEnd(20)} ${(fs.statSync(pot).size / 1024).toFixed(0)} KB  ${stanje}`);
  }
  ws.close(); chrome.kill();
  console.log(`\nposnetki: ${IZHOD}`);
})().catch(e => { console.error("SMRT:", e.message); process.exit(1); });
