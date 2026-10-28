/* Vizualna presoja preimenovane povrsine: naslovnica filma in navigacija
   glavne strani, oba pri 1440x900. Slika mora ustrezati merjeni trditvi,
   zato se besedilo izmeri iz DOM-a in izpiše skupaj s potjo do datoteke. */
const { spawn } = require("child_process");
const fs = require("fs");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9431, wait = ms => new Promise(r => setTimeout(r, ms));
const PRIMERI = [
  { ime: "vrata", url: "http://127.0.0.1:4183/zgodba.html", zasl: [1440, 900, 1],
    beri: `JSON.stringify({
      naslov: (document.querySelector('.vr-naslov') || {}).textContent,
      obaOznaka: Array.from(document.querySelectorAll('.vr-skupina')).map(e => e.getAttribute('aria-label')),
      gumbi: Array.from(document.querySelectorAll('.vr-gumb')).map(e => e.textContent.trim().replace(/\\s+/g,' ')),
      ukazi: Array.from(document.querySelectorAll('.vr-ukazi .gumb')).map(e => e.textContent.trim()),
      pas: (document.querySelector('.klapa-t') || {}).textContent })` },
  { ime: "vrata-320", url: "http://127.0.0.1:4183/zgodba.html", zasl: [320, 640, 2],
    beri: `JSON.stringify({
      oznaki: Array.from(document.querySelectorAll('.vr-oznaka')).map(e => e.textContent),
      gumbi: Array.from(document.querySelectorAll('.vr-gumb')).map(e => e.textContent.trim().replace(/\\s+/g,' ')),
      prelit: Array.from(document.querySelectorAll('.vr-gumb,.vr-oznaka,.vr-lede')).map(e => e.textContent.trim().slice(0,18) + ' ' + (e.scrollWidth - e.clientWidth) + 'px'),
      naslovVisina: Math.round(document.querySelector('.vr-naslov').getBoundingClientRect().height) })` },
  { ime: "nav", url: "http://127.0.0.1:4183/index.html", zasl: [1440, 900, 1],
    beri: `JSON.stringify({
      nav: Array.from(document.querySelectorAll('#elNav a, .nav a')).map(e => e.textContent.trim() + ' -> ' + (e.getAttribute('href') || e.getAttribute('data-go'))),
      title: document.title })` },
];
(async () => {
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}\\cdp-naslovnica-${Date.now()}`,
    "--no-first-run", "--window-size=1500,1000", "about:blank"], { stdio: "ignore" });
  let v; for (let i = 0; i < 40; i++) { try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await wait(400); } }
  const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener("open", r));
  let n = 0; const p = new Map();
  const send = (m, pr = {}, sid) => new Promise((res, rej) => { const id = ++n; p.set(id, { res, rej });
    ws.send(JSON.stringify(sid ? { id, method: m, params: pr, sessionId: sid } : { id, method: m, params: pr })); });
  ws.addEventListener("message", ev => { const m = JSON.parse(ev.data); if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id); m.error ? q.rej(new Error(JSON.stringify(m.error))) : q.res(m.result); } });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const sess = (m, pr = {}) => send(m, pr, sessionId);
  const ev = async ex => { const r = await sess("Runtime.evaluate", { expression: ex, returnByValue: true });
    if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description || r.exceptionDetails)); return r.result.value; };
  await sess("Page.enable"); await sess("Runtime.enable");
  for (const c of PRIMERI) {
    await sess("Emulation.setDeviceMetricsOverride", { width: c.zasl[0], height: c.zasl[1],
      deviceScaleFactor: c.zasl[2], mobile: c.zasl[2] > 1 });
    await sess("Page.navigate", { url: c.url });
    for (let i = 0; i < 80; i++) { if (await ev("document.readyState === 'complete'")) break; await wait(120); }
    await wait(2200);
    const podatki = JSON.parse(await ev(c.beri));
    const s = await sess("Page.captureScreenshot", { format: "png" });
    const pot = `${process.env.TEMP}\\rka-povrsina-${c.ime}.png`;
    fs.writeFileSync(pot, Buffer.from(s.data, "base64"));
    console.log(`${pot}  ${fs.statSync(pot).size} B`);
    for (const [k, v] of Object.entries(podatki)) console.log(`  ${k}: ${JSON.stringify(v)}`);
    const robovi = await ev(`(() => { const e = document.querySelector('.vr-naslov') || document.querySelector('.nav a');
      if (!e) return 'ni elementa'; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return Math.round(r.width) + 'x' + Math.round(r.height) + ' px pri ' + cs.fontSize + ' pisavi, prelit '
        + (e.scrollWidth - e.clientWidth) + 'px'; })()`);
    console.log(`  geometria: ${robovi}`);
  }
  ws.close(); chrome.kill();
})().catch(e => { console.error("SMRT:", e.message); process.exitCode = 2; });
