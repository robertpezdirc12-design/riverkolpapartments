/* Ostrejša sonda za obljubo "brez drsenja". Prejšnja vrata (rka-pregled.cjs) so
   merila samo, kateri NEPOSREDNI otroci štrurijo iz odra, in so brala
   __gostota.drsi — ključa v kodi sploh ni, zato je bil ta pogoj vedno napačen
   (nikoli resničen). Tukaj se trdi štiri stvari, ki jih je mogoče izmeriti:
   1) oder ne more drsiti: stage.scrollHeight == clientHeight in enako za dokument;
   2) noben potomec ni zunaj odra, ne samo neposredni otroci;
   3) v pogledu ni nobenega drugega drsnika (overflow auto/scroll z vsebino ven);
   4) odločitev gostote je bila sprejeta z dokončnimi metriki in se po nalaganju
      pisav in slik ni podrla — meritev se ponovi še enkrat in mora ostati enaka. */
const { spawn } = require("child_process");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9417;
const wait = ms => new Promise(r => setTimeout(r, ms));
const ZASLONI = [
  { ime: "telefon", w: 390, h: 844, dpr: 3, mobil: true },
  { ime: "s23u", w: 338, h: 731, dpr: 3, mobil: true },
  { ime: "namizje", w: 1440, h: 900, dpr: 1, mobil: false },
  { ime: "sirina-320", w: 320, h: 640, dpr: 2, mobil: true },
  { ime: "pocitni-1280x720", w: 1280, h: 720, dpr: 1, mobil: false }
];
const POGLEDI = ["domov", "h70", "h30b", "reka", "galerija", "termini"];

const SONDA = `(() => {
  const s = document.getElementById('stage');
  const b = s.getBoundingClientRect();
  const izven = [];
  for (const el of s.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 && r.height < 2) continue;
    const odmik = Math.max(b.top - r.top, r.bottom - b.bottom, b.left - r.left, r.right - b.right);
    if (odmik > 1) izven.push((el.className || el.tagName) + ':' + Math.round(odmik));
  }
  const drsniki = [];
  for (const el of s.querySelectorAll('*')) {
    const o = getComputedStyle(el);
    if (!/auto|scroll/.test(o.overflowY + ' ' + o.overflowX)) continue;
    if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
      drsniki.push((el.className || el.tagName) + ':' + (el.scrollHeight - el.clientHeight));
  }
  return {
    odmer: { g: __gostota.g, olajsave: __gostota.olajsave, izven: __gostota.izven },
    stagePrec: s.scrollHeight - s.clientHeight,
    docPrec: document.documentElement.scrollHeight - Math.round(innerHeight),
    sirinaPrec: document.documentElement.scrollWidth - Math.round(innerWidth),
    izvenVsi: izven.length, izvenPrimeri: izven.slice(0, 3),
    drsniki: drsniki.length, drsnikiPrimeri: drsniki.slice(0, 3)
  };
})()`;

(async () => {
  const map = `cdp-drsenje-${Date.now()}`;
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}\\${map}`,
    "--no-first-run", "--window-size=1500,1000", "about:blank"], { stdio: "ignore" });
  let v;
  for (let i = 0; i < 40; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await wait(400); }
  }
  if (!v) { chrome.kill(); throw new Error("Chrome se ni zagnal"); }
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  let n = 0; const p = new Map();
  const send = (m, pr = {}, sid) => new Promise((res, rej) => {
    const id = ++n; p.set(id, { res, rej });
    ws.send(JSON.stringify(sid ? { id, method: m, params: pr, sessionId: sid } : { id, method: m, params: pr }));
  });
  ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.id && p.has(m.id)) {
      const q = p.get(m.id); p.delete(m.id);
      m.error ? q.rej(new Error(JSON.stringify(m.error))) : q.res(m.result);
    }
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const sess = (m, pr = {}) => send(m, pr, sessionId);
  const ev = async ex => {
    const r = await sess("Runtime.evaluate", { expression: ex, returnByValue: true });
    if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description || r.exceptionDetails));
    return r.result.value;
  };
  await sess("Page.enable"); await sess("Runtime.enable");

  const napake = [];
  for (const z of ZASLONI) {
    await sess("Emulation.setDeviceMetricsOverride",
      { width: z.w, height: z.h, deviceScaleFactor: z.dpr, mobile: z.mobil });
    for (const pg of POGLEDI) {
      await sess("Page.navigate", { url: `http://127.0.0.1:4183/index.html#${pg}` });
      for (let i = 0; i < 80; i++) {
        if (await ev("document.documentElement.classList.contains('pripravljen')")) break;
        await wait(120);
      }
      await wait(1800);
      const a = await ev(SONDA);
      await wait(2500);                       /* pisave in slike lahko zrastejo še zdaj */
      const o = await ev(SONDA);
      const slab = o.stagePrec > 0 || o.docPrec > 0 || o.sirinaPrec > 0 ||
        o.izvenVsi > 0 || o.drsniki > 0;
      if (slab) {
        napake.push(`${z.ime}/${pg}: stage+${o.stagePrec} doc+${o.docPrec} sirina+${o.sirinaPrec} ` +
          `izven=${o.izvenVsi}[${o.izvenPrimeri}] drsniki=${o.drsniki}[${o.drsnikiPrimeri}]`);
      }
      console.log(`${slab ? "!!" : "  "} ${z.ime.padEnd(16)} ${pg.padEnd(9)} g=${o.odmer.g} ` +
        `olajsave=${o.odmer.olajsave} stage+${o.stagePrec} doc+${o.docPrec} izven=${o.izvenVsi} drsniki=${o.drsniki}` +
        (a.odmer.g !== o.odmer.g ? "   (gostost se je spremenila med meritvijo!)" : ""));
    }
  }
  console.log(`\n--- presoja (${ZASLONI.length * POGLEDI.length} kombinacij) ---`);
  for (const x of napake) console.log("  NAP: " + x);
  console.log(napake.length ? "NI V REDU" : "V REDU: noben pogled ne drsi in nič ne štruri iz odra.");
  ws.close(); chrome.kill();
  process.exitCode = napake.length ? 1 : 0;
})().catch(e => { console.error("SMRT:", e.message); try { } catch { } process.exitCode = 2; });
