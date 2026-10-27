/* Kje točno se raztegne pogled: vsak blok z mero, po pravi emulaciji zaslona.
   Zunanje orodje, ne del strani. */
const { spawn } = require("child_process");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const POGLED = process.argv[2] || "h70";
const [W, H] = (process.argv[3] || "768x1024").split("x").map(Number);
const DPR = Number(process.argv[4] || 1);
const MOBIL = DPR > 1;
const PORT = 9400 + (process.pid % 60);
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const profil = `${process.env.TEMP}\\cdp-sonda-${PORT}`;
  try { require("fs").rmSync(profil, { recursive: true, force: true }); } catch { /* zaklenjena mapa */ }
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profil}`, "--no-first-run",
    "--window-size=1500,1100", "about:blank"], { stdio: "ignore" });
  let versija;
  for (let i = 0; i < 25; i++) {
    try { versija = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await wait(400); }
  }
  const ws = new WebSocket(versija.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  let n = 0; const pending = new Map();
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = ++n; pending.set(id, { res, rej });
    ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  });
  ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  });
  const { targetId } = await send("Target.createTarget", { url: `http://127.0.0.1:4183/index.html#${POGLED}` });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const sess = (m, p = {}) => send(m, p, sessionId);
  await sess("Emulation.setDeviceMetricsOverride",
    { width: W, height: H, deviceScaleFactor: DPR, mobile: MOBIL });
  for (let i = 0; i < 40; i++) {
    const r = await sess("Runtime.evaluate", { returnByValue: true,
      expression: "document.documentElement.classList.contains('pripravljen')" });
    if (r.result.value === true) break;
    await wait(150);
  }
  await sess("Runtime.evaluate", { expression: `(() => {
    const s = document.querySelector('#stage');
    if (s.firstElementChild) s.firstElementChild.style.animation = 'none';
    document.querySelectorAll('#stage img').forEach(i => { i.loading = 'eager'; });
  })()` });
  for (let i = 0; i < 40; i++) {
    const r = await sess("Runtime.evaluate", { returnByValue: true,
      expression: `[...document.querySelectorAll('#stage img')].every(i => i.complete && i.naturalWidth > 0)` });
    if (r.result.value === true) break;
    await wait(150);
  }
  await wait(400);
  const r = await sess("Runtime.evaluate", { returnByValue: true, expression: `(() => {
    const s = document.querySelector('#stage'), g = s.firstElementChild;
    const vr = s.getBoundingClientRect();
    const izmeri = (o) => {
      const b = o.getBoundingClientRect();
      return { blok: (o.className || o.tagName).toString().slice(0, 26),
               visina: Math.round(b.height),
               podRob: Math.round(b.bottom - vr.bottom),
               na: o.tagName.toLowerCase() };
    };
    const otrok = [...g.children].map(izmeri);
    const krivci = [...g.querySelectorAll('*')]
      .map(o => ({ o, b: o.getBoundingClientRect(), p: o.parentElement.getBoundingClientRect() }))
      .filter(x => x.b.bottom > x.p.bottom + 1 || x.b.top < x.p.top - 1)
      .map(x => ({ ...izmeri(x.o), starš: (x.o.parentElement.className || x.o.parentElement.tagName).toString().slice(0, 22),
                   presezek: Math.round(x.b.bottom - x.p.bottom),
                   besedilo: (x.o.textContent || '').trim().slice(0, 24) }));
    const mer = (o) => ({ rect: Math.round(o.getBoundingClientRect().height),
      offsetHeight: o.offsetHeight, scrollHeight: o.scrollHeight,
      odmevka: getComputedStyle(o).paddingTop + '/' + getComputedStyle(o).paddingBottom,
      porocilo: getComputedStyle(o).gridTemplateRows.slice(0, 60) });
    return JSON.stringify({ zaslona: innerWidth + 'x' + innerHeight, gostota: window.__gostota,
      stage: { visina: Math.round(vr.height), scrollHeight: s.scrollHeight, clientHeight: s.clientHeight },
      mer_stag: mer(s), mer_pogled: mer(g),
      mer_info: mer(g.querySelector('.lok-info') || g),
      otrok, krivci });
  })()` });
  console.log(JSON.stringify(JSON.parse(r.result.value), null, 1));
  ws.close(); chrome.kill();
})().catch(e => { console.error("NAPAKA:", e.message); process.exit(1); });
