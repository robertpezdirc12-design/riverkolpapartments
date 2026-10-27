/* Neposredno vprašanje: ali se oder lahko premakne? Ne merimo le geometrije,
   ampak se pomakniti poskusimo — to je pogoj, ki ga je Robert postavil.
   Zunanje orodje, ne del strani. */
const { spawn } = require("child_process");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9556;
const ZASLONI = [
  { ime: "namizje", w: 1440, h: 900, dpr: 1, mobil: false },
  { ime: "prenosnik", w: 1280, h: 720, dpr: 1, mobil: false },
  { ime: "telefon", w: 390, h: 844, dpr: 3, mobil: true },
  { ime: "s23u", w: 338, h: 731, dpr: 3, mobil: true },
  { ime: "tablica", w: 768, h: 1024, dpr: 2, mobil: true }
];
const POGLEDI = ["domov", "h70", "h30b", "reka", "galerija", "termini"];
/* Elementna hoja ne vidi psevdo-elementov (`.lok-info::before` ima negativen
   inset), zato je jedkanje kontejnerjev samostojen pogoj: plast, ki nosi
   vsebino, mora sejati vse, kar gre lahko čez rob. */
const KLIP = ["html", "body", "stage", "view"];
/* Matrika je skopirana po meri: z okoljem jo lahko zmanjša mutacijski test,
   da vsaka vbrizgana napaka ne stane celega obroka. */
const V_BAZI = process.env.RKA_URL || "http://127.0.0.1:4183/index.html";
/* Matriko lahko narežemo po meri: mutacijski test z majhno matriko hitreje
   preveri vsako vbrizgano napako, celotno matriko poganjamo šele ob predaji. */
const samo = s => (s ? s.split(",").map(x => x.trim()).filter(Boolean) : null);
const ZASLENI = process.env.RKA_ZASLONI ? ZASLONI.filter(z => samo(process.env.RKA_ZASLONI).includes(z.ime)) : ZASLONI;
const POGLEDI_run = process.env.RKA_POGLEDI ? POGLEDI.filter(z => samo(process.env.RKA_POGLEDI).includes(z)) : POGLEDI;
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  try { require("fs").rmSync(`${process.env.TEMP}\\cdp-drsenje`, { recursive: true, force: true }); } catch { }
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}\\cdp-drsenje`,
    "--no-first-run", "--window-size=1500,1000", "about:blank"], { stdio: "ignore" });
  let v;
  for (let i = 0; i < 30; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await wait(400); }
  }
  if (!v) throw new Error("Chrome se ni zagnal");
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
  await sess("Page.enable"); await sess("Runtime.enable");
  const evalj = async ex => {
    const r = await sess("Runtime.evaluate", { expression: ex, returnByValue: true });
    if (r.exceptionDetails) throw new Error("JS: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails));
    return r.result.value;
  };

  const izvid = [];
  for (const z of ZASLENI) {
    await sess("Emulation.setDeviceMetricsOverride",
      { width: z.w, height: z.h, deviceScaleFactor: z.dpr, mobile: z.mobil });
    for (const pg of POGLEDI_run) {
      await sess("Page.navigate", { url: `${V_BAZI}#${pg}` });
      let pripravljeno = false;
      for (let i = 0; i < 60; i++) {
        if (await evalj("document.documentElement.classList.contains('pripravljen')")) { pripravljeno = true; break; }
        await wait(120);
      }
      if (!pripravljeno) throw new Error(`${z.ime}/${pg}: strani se nikoli ne prikaže`);
      let slike = { skupaj: 0, done: -1 };
      for (let i = 0; i < 40; i++) {
        slike = JSON.parse(await evalj(`(() => {const s=[...document.images].filter(i=>i.getAttribute('src')&&i.getBoundingClientRect().width>0);
          return JSON.stringify({skupaj:s.length,done:s.filter(i=>i.complete&&i.naturalWidth>0).length});})()`));
        if (slike.done === slike.skupaj) break;
        await wait(150);
      }
      await wait(1200);
      const m = JSON.parse(await evalj(`(() => {
        const s = document.querySelector('#stage'), g = window.__gostota || {};
        const meje = s.getBoundingClientRect();
        /* Jedkanje: katera od plasti, ki nosijo vsebino, še sejejo prehod? */
        const plasti = { html: document.documentElement, body: document.body,
          stage: s, view: s.firstElementChild };
        const jedkanje = [];
        for (const ime of ${JSON.stringify(KLIP)}) {
          const el = plasti[ime]; if (!el) { jedkanje.push(ime + ':ni'); continue; }
          const c = getComputedStyle(el);
          if (c.overflowX !== 'hidden' && c.overflowX !== 'clip') jedkanje.push(ime + ':' + c.overflowX);
          if (c.overflowY !== 'hidden' && c.overflowY !== 'clip') jedkanje.push(ime + ':' + c.overflowY);
        }
        /* Poskus pomika na vseh treh mestih, kjer bi drsenje lahko nastalo. */
        window.scrollTo(0, 600); s.scrollTop = 600; document.documentElement.scrollTop = 600;
        const pomak = Math.max(window.scrollY, document.documentElement.scrollTop, s.scrollTop);
        window.scrollTo(0, 0); s.scrollTop = 0; document.documentElement.scrollTop = 0;
        const zunaj = [...s.querySelectorAll('*')].filter(o => {
          const r = o.getBoundingClientRect();
          return (r.width >= 2 || r.height >= 2) &&
            (r.top < meje.top - 1 || r.bottom > meje.bottom + 1 ||
             r.left < meje.left - 1 || r.right > meje.right + 1);
        }).map(o => (typeof o.className === 'string' ? o.className : o.tagName).slice(0, 18));
        return JSON.stringify({ g: g.g, olajsave: g.olajsave, pomak, jedkanje,
          zunaj: zunaj.length, krivci: zunaj.slice(0, 3),
          prelivi: s.scrollHeight - s.clientHeight,
          slike: slike_skupaj() });
        function slike_skupaj(){const sl=[...document.images].filter(i=>i.getAttribute('src')&&i.getBoundingClientRect().width>0);
          return sl.length+'/'+sl.filter(i=>i.complete&&i.naturalWidth>0).length;}
      })()`));
      izvid.push({ zaslon: `${z.ime} ${z.w}x${z.h}`, pogled: pg, ...m });
    }
  }
  console.table(izvid.map(x => ({ zaslon: x.zaslon, pogled: x.pogled, gostota: x.g,
    olajsave: x.olajsave, pomak: x.pomak, zunaj: x.zunaj, jedkanje: x.jedkanje.join(" ") || "-",
    prelivi: x.prelivi, slike: x.slike })));
  const slabi = izvid.filter(x => x.pomak > 0 || x.zunaj > 0 || x.jedkanje.length ||
    x.slike.split("/")[0] !== x.slike.split("/")[1]);
  console.log("slabih (drsni, je vsebina zunaj ali plast ne seje):", slabi.length, "/", izvid.length);
  for (const s of slabi) console.log("  -", s.zaslon, s.pogled, "pomak=" + s.pomak,
    "zunaj=" + s.zunaj, "jedkanje=" + (s.jedkanje.join(",") || "-"), JSON.stringify(s.krivci));
  /* Strojno berljiva sled: mutacijski test ne razčlenjuje tabele. */
  console.log("JSON " + JSON.stringify(izvid));
  ws.close(); chrome.kill();
})().catch(e => { console.error("NAPAKA:", e.message); process.exit(1); });
