/* Zakaj je platno v :60 črno, v :30 pa ne? Vprašamo DOM, ne ugibamo.
   Zunanje orodje, ne del strani. */
const { spawn, spawnSync } = require("child_process");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9416;
const wait = ms => new Promise(r => setTimeout(r, ms));
const CISTI = [];

(async () => {
  const profil = `cdp-sonda-${Date.now()}`;
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}\\${profil}`,
    "--no-first-run", "--window-size=1500,1000", "about:blank"], { stdio: "ignore" });
  CISTI.push(() => { try { spawnSync("taskkill", ["/T", "/F", "/PID", String(chrome.pid)], { stdio: "ignore" }); } catch { chrome.kill(); } });
  let v;
  for (let i = 0; i < 40; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await wait(400); }
  }
  if (!v) throw new Error("Chrome se ni zagnal");
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  CISTI.push(() => { try { ws.close(); } catch {} });
  let n = 0; const p = new Map();
  const send = (m, pr = {}, sid) => new Promise((res, rej) => {
    const id = ++n;
    const ura = setTimeout(() => { const q = p.get(id); if (q) { p.delete(id); q.rej(new Error(`CDP ${m} rok`)); } }, 25000);
    p.set(id, { res: x => { clearTimeout(ura); res(x); }, rej: x => { clearTimeout(ura); rej(x); } });
    ws.send(JSON.stringify(sid ? { id, method: m, params: pr, sessionId: sid } : { id, method: m, params: pr }));
  });
  ws.addEventListener("message", ev => { const m = JSON.parse(ev.data);
    if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id);
      m.error ? q.rej(new Error(JSON.stringify(m.error))) : q.res(m.result); } });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const sess = (m, pr = {}) => send(m, pr, sessionId);
  const ev = async ex => {
    const r = await sess("Runtime.evaluate", { expression: ex, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails));
    return r.result.value;
  };
  await sess("Page.enable"); await sess("Runtime.enable");
  await sess("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  for (const rez of ["60", "30"]) {
    await sess("Page.navigate", { url: "http://127.0.0.1:4183/zgodba.html?render=1" });
    for (let i = 0; i < 80; i++) { if (await ev("typeof seznam !== 'undefined' && seznam.length > 0")) break; await wait(150); }
    await ev(`document.getElementById('vBrezZvoka').click()`);
    await wait(900);
    await ev(`ustavi(); nastaviRez(${JSON.stringify(rez)}); nastaviJezik("en"); 1`);
    await wait(2600);
    const id = rez === "60" ? "k07" : "k07";
    const porocilo = await ev(`(() => {
      const v = seznam.find(w => w.id === ${JSON.stringify(id)});
      const s = v.zacetek + Math.min(0.35, (v.konec - v.zacetek) * 0.5);
      ustavi(); izris(s);
      const cs = getComputedStyle(v.el), img = v.el.querySelector('img');
      const ics = img ? getComputedStyle(img) : null;
      const r = v.el.getBoundingClientRect();
      const naSredini = document.elementFromPoint(720, 450);
      const prekriva = naSredini ? (naSredini.closest('.kader') === v.el) : null;
      return JSON.stringify({
        rez: ${JSON.stringify(rez)}, id: v.id, cas: +s.toFixed(2),
        vidno: v.el.classList.contains('vidno'), klasi: v.el.className,
        clip: cs.clipPath, visibility: cs.visibility, opacity: cs.opacity,
        display: cs.display, zIndex: cs.zIndex, rect: [r.width, r.height].map(Math.round).join('x'),
        imgSrc: img ? img.currentSrc.slice(-40) : null,
        imgNarav: img ? img.naturalWidth + 'x' + img.naturalHeight : null,
        imgOpacity: ics && ics.opacity, imgFilter: ics && ics.filter, imgRect: img
          ? [Math.round(img.getBoundingClientRect().width), Math.round(img.getBoundingClientRect().height)].join('x') : null,
        naSredini: naSredini ? (naSredini.tagName + '.' + String(naSredini.className).split(' ')[0]) : null,
        prekriva,
        overlayi: [...document.querySelectorAll('body *')].filter(e => {
          const q = e.getBoundingClientRect();
          return q.width > 1200 && q.height > 700 && e !== v.el && !v.el.contains(e) &&
                 getComputedStyle(e).position === 'fixed' && getComputedStyle(e).display !== 'none' &&
                 getComputedStyle(e).visibility !== 'hidden';
        }).map(e => e.tagName + '#' + e.id + '.' + String(e.className).split(' ')[0] +
                    ' opacity=' + getComputedStyle(e).opacity + ' z=' + getComputedStyle(e).zIndex)
      }, null, 1);
    })()`);
    console.log(porocilo);
  }
})().catch(e => { console.error("NAPAKA:", e.message); process.exitCode = 1; })
  .finally(() => { for (const f of CISTI.reverse()) { try { f(); } catch {} }
                   if (process.exitCode) process.exit(process.exitCode); });
