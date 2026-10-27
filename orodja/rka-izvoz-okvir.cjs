/* KAJ JE ZARES ZGOREJ v predanem kadru?
   Vrata rka-zgodba-sonda.cjs trdijo, da izvoznik vidi zamrznjeno platno. Številka
   "rob" ob IZVOZ sme biti torej izmerjena iz predane datoteke, ne izračunana iz
   CSS: prav to je napaka, ki jo ta sonda popravlja (izračunani cilji 150 in
   103,68 px sta bila napačna — pravi merita 140 px in 123,11 px).
   Naredi dve stvari:
     1) z današnjo CSS sestavi okvir, ki ga izvoznik izriše (isti izris(s), isti
        okni, isti Chrome zastavice kot rka-render.cjs), in ga shrani kot PNG;
     2) izpiši geometrijo napisa: notranjo višino, razrešeno 100svh, izračunan rob
        (bottom) in pravokotnik.
   Par PNG-jev nato obdela rka-izvoz-okvir.py, ki v predani datoteki išče enako
   sled beznega besedila in pove, kolikor pikslov se je platno premaknilo.
   Uporaba: node rka-izvoz-okvir.cjs [rez=60] [jezik=sl] */
const { spawn } = require("child_process");
const fs = require("fs");
const { zzeni } = require("./rka-streznik.cjs");

const SPLAT = "C:\\Users\\admin\\Downloads\\sssdf\\rka-onepage";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9417;
const REZ = process.argv[2] || "60";
const JEZIK = process.argv[3] || "sl";
const CILJI = [
  { ime: "pokonci", url: "/zgodba.html?render=1&razmerje=9x16", w: 1080, h: 1920 },
  { ime: "leznik", url: "/zgodba.html?render=1", w: 1920, h: 1080 }
];
const wait = ms => new Promise(r => setTimeout(r, ms));
const CISTI = [];

(async () => {
  let streznik = null, vrata = 0;
  for (const p of [4195, 4196, 4197]) {
    try { streznik = await zzeni(SPLAT, p); vrata = p; break; } catch { }
  }
  if (!streznik) throw new Error("prostih ni strežniških vrat (4195-4197)");
  CISTI.push(() => streznik.close());

  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
    "--force-device-scale-factor=1", "--font-render-hinting=none",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${process.env.TEMP}\\cdp-okvir-${Date.now()}`,
    "--no-first-run", "--window-size=1080,1920", "about:blank"
  ], { stdio: "ignore" });
  CISTI.push(() => { try { chrome.kill(); } catch { } });

  let v;
  for (let i = 0; i < 60; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await wait(300); }
  }
  if (!v) throw new Error("Chrome se ni zagnal");
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  CISTI.push(() => { try { ws.close(); } catch { } });
  let n = 0; const p = new Map();
  const send = (m, pr = {}, sid) => new Promise((res, rej) => {
    const id = ++n; p.set(id, { res, rej });
    ws.send(JSON.stringify(sid ? { id, method: m, params: pr, sessionId: sid } : { id, method: m, params: pr }));
  });
  ws.addEventListener("message", e => {
    const m = JSON.parse(e.data);
    if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id);
      m.error ? q.rej(new Error(JSON.stringify(m.error))) : q.res(m.result); }
  });
  const izvedi = async (izraz, cakaj = false) => {
    const r = await Promise.race([
      send("Runtime.evaluate", { expression: izraz, returnByValue: true, awaitPromise: cakaj }, sid),
      new Promise((_, rej) => setTimeout(() => rej(new Error("Runtime.evaluate teče > 25 s")), 25000))
    ]);
    if (r.exceptionDetails) throw new Error("JS: " + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result.value;
  };
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: sid } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sid); await send("Runtime.enable", {}, sid);

  for (const c of CILJI) {
    await send("Emulation.setDeviceMetricsOverride",
      { width: c.w, height: c.h, deviceScaleFactor: 1, mobile: false }, sid);
    await send("Page.navigate", { url: `http://127.0.0.1:${vrata}${c.url}` }, sid);
    for (let i = 0; i < 40; i++) { if ((await izvedi("document.readyState")) === "complete") break; await wait(400); }
    await wait(1500);
    await izvedi(`(() => { const g = document.getElementById('vBrezZvoka'); if (!g) throw new Error('gumba ni'); g.click(); return 1; })()`);
    await wait(1200);
    await izvedi(`nastaviRez(${JSON.stringify(REZ)}); 1`, false);
    await izvedi(`nastaviJezik(${JSON.stringify(JEZIK)}); 1`, false);
    await wait(1800);
    await izvedi(`(async () => { ustavi(); await document.fonts.ready;
      const s = [...document.querySelectorAll('.kader img')];
      await Promise.all(s.map(x => x.decode().catch(() => {})));
      [...document.querySelectorAll('.kader video')].forEach(v => v.pause());
      return 1; })()`, true);

    const geo = await izvedi(`(() => { const m = document.createElement('div');
      m.style.cssText = 'position:fixed;top:0;left:0;height:100svh;width:1px;visibility:hidden';
      document.body.appendChild(m);
      const g = { notranjaVisina: innerHeight, svh100: Math.round(m.getBoundingClientRect().height * 100) / 100,
        dpr: devicePixelRatio, pokonci: document.body.classList.contains('pokonci'),
        render: document.body.classList.contains('render'),
        robVpeto: getComputedStyle(document.documentElement).getPropertyValue('--rob-s').trim(),
        napisBottom: getComputedStyle(document.querySelector('.napisi')).bottom,
        napisVisina: Math.round(document.querySelector('.napisi').getBoundingClientRect().height),
        oprema: getComputedStyle(document.getElementById('transport')).display };
      m.remove(); return g; })()`);
    console.log(`\n=== ${c.ime} ${c.w}x${c.h} ===`);
    console.log("geometrija:", JSON.stringify(geo));

    /* Najdi najdaljši čas, ko je napis čisto zabrisan (sled opacity = 1), da
       merimo mirovanje, ne prehoda. */
    const scan = await izvedi(`(async () => {
      const dolzina = SPOT.rezi[${JSON.stringify(REZ)}].dolzina;
      const sled = [];
      for (let t = 0; t < dolzina; t += 0.2) {
        izris(t);
        const vidni = [...document.querySelectorAll('.napis')].map(e => ({
          o: +getComputedStyle(e).opacity, b: Math.round(e.getBoundingClientRect().bottom * 100) / 100,
          t: e.textContent.trim().slice(0, 34) })).filter(e => e.o > 0.99 && e.t);
        sled.push({ t: Math.round(t * 10) / 10, d: vidni.length,
          b: vidni.length ? vidni[0].b : null, z: vidni.length ? vidni[0].t : "" });
        await new Promise(r => setTimeout(r, 6));
      }
      return sled; })()`, true);
    const mirni = scan.filter(x => x.d === 1 && x.b != null);
    console.log(`napis je mirno viden v ${mirni.length} vzorcih x 0,2 s`);
    const spodnja = [...new Set(mirni.map(x => x.b))];
    console.log("spodnji rob napisnega bloka (px od vrha okna):", JSON.stringify(spodnja));
    console.log("odstop od dna (px):", JSON.stringify([...new Set(spodnja.map(b => Math.round((c.h - b) * 100) / 100))]));
    /* Shrani tri okvirje z razporejenimi napisi, da jih lahko primerjam s predanim
       masterjem: prva, srednja in zadnja mirna vzorca. */
    const izbrani = [mirni[0], mirni[Math.floor(mirni.length / 2)], mirni[mirni.length - 1]].filter(Boolean);
    for (const [i, ok] of izbrani.entries()) {
      await izvedi(`izris(${ok.t.toFixed(2)}); 1`);
      await wait(90);
      const { data } = await send("Page.captureScreenshot",
        { format: "png", clip: { x: 0, y: 0, width: c.w, height: c.h, scale: 1 } }, sid);
      const pot = `${process.env.TEMP}\\rka-izvoz-${c.ime}-${REZ}${JEZIK}-${i}.png`;
      fs.writeFileSync(pot, Buffer.from(data, "base64"));
      console.log(`okvir ${i}: t=${ok.t}s napis="${ok.z}" rob_od_dna=${Math.round((c.h - ok.b) * 100) / 100} → ${pot}`);
    }
  }
  console.log("\nV REDU: okvirji shranjeni.");
})().catch(e => { console.error("SMRT:", e.message); process.exitCode = 1; })
  .finally(() => { for (const f of CISTI.reverse()) { try { f(); } catch { } } });
