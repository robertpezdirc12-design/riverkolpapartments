/* Posnetki za Robertov ogled: kaj je zdaj na platiscu v anglekini in na spletni
   strani. Zunanje orodje, ne del strani.

   Nikoli ne slica med vhodom: najprej ustavi() in izris(t), nato cakaj na
   dekodirano sliko kadra. Slicna casovnica je fiksna, zato je kader znan. */
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9415;
const OUT = "C:\\Users\\admin\\AppData\\Local\\Temp\\rka-shot";
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ZaNi: katere kader in kateri rez hoemo posneti. Sredina okna je najvarnejsa,
   ker prehod traja v zaetek in konec. */
/* Vrstni red NI poljuben: v treh zaporednih zagonih so bila platna PRVEGA
   prehoda vedno črna (DOM je trdil, da je slika dekodirana in na sredini),
   naslednji pa pravilni. Zato :30 snemamo najprej — če črnina sledi prehodu,
   gre za segrevanje kompozitorja v headless instanci, ne za rez. */
const PLATNA = [
  { dat: "zgodba.html", rez: "30", jezik: "en", kadri: ["k07", "k12", "k21"], prefix: "en30" },
  { dat: "zgodba.html", rez: "60", jezik: "en", kadri: ["k07", "k12", "k21"], prefix: "en60" },
  { dat: "zgodba.html", rez: "60", jezik: "sl", kadri: ["k12"], prefix: "sl60" }
];
const STRAN = [
  { pog: "domov", z: { w: 1440, h: 900, dpr: 1, mobil: false }, ime: "domov-namizje" },
  { pog: "reka", z: { w: 1440, h: 900, dpr: 1, mobil: false }, ime: "reka-namizje" },
  { pog: "domov", z: { w: 338, h: 731, dpr: 3, mobil: true }, ime: "domov-s23u" }
];

const CISTI = [];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  /* Profil DOBI datum: dve zaporedni zagoni na istem profilu se ubijeta z EPERM,
     ker prejsnji Chrome še drži mapo (in to tiho, ker je izpis cevovod). */
  const profil = `cdp-posnetki-${Date.now()}`;
  console.log("profil:", profil);
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--mute-audio", "--force-device-scale-factor=1", "--font-render-hinting=none",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${process.env.TEMP}\\${profil}`,
    "--no-first-run", "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
  CISTI.push(() => {
    try { spawnSync("taskkill", ["/T", "/F", "/PID", String(chrome.pid)], { stdio: "ignore" }); }
    catch { chrome.kill(); }
  });
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
    /* Brez roka bi ugrabljen kader (npr. decode(), ki nikoli ne vrne) pustil
       orodje viseti brez izpisa — to je bila napaka prejšnjega zagona. */
    const ura = setTimeout(() => { const q = p.get(id); if (q) { p.delete(id); q.rej(new Error(`CDP ${m} #${id}: rok 25 s`)); } }, 25000);
    const zmag = f => v => { clearTimeout(ura); f(v); };
    p.set(id, { res: zmag(res), rej: zmag(rej) });
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
    const r = await sess("Runtime.evaluate", { expression: ex, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails));
    return r.result.value;
  };
  await sess("Page.enable"); await sess("Runtime.enable");

  const posnesi = async (pot) => {
    const { data } = await sess("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT, pot), Buffer.from(data, "base64"));
    console.log("  posneto", pot);
  };

  /* --- zgodba: platisce z besedilom --- */
  const PREBERI = `(() => {
    const i = indeksNa(zadnjiCas), v = seznam[i];
    const n = v.napisEl, k = v.kader;
    return JSON.stringify({
      id: v.id, z: +v.zacetek.toFixed(2), kk: +v.konec.toFixed(2),
      vrsta: k.vrsta, usedel: v.el.classList.contains('vidno'),
      napisiVidni: n ? +getComputedStyle(n).opacity : 1,
      eba: n ? (n.querySelector('.n-eyebrow') || {}).textContent?.trim() || null : null,
      naslov: n ? (n.querySelector('.n-naslov') || {}).textContent?.trim() || null : null,
      pod: n ? (n.querySelector('.n-pod') || {}).textContent?.trim() || null : null,
      znacke: n ? [...n.querySelectorAll('.n-znacke span')].map(x => x.textContent.trim()) : null,
      zakljucek: k.vrsta === 'zakljucek' ? {
        eba: (v.el.querySelector('.k-one-t') || {}).textContent?.trim() || null,
        beso: (v.el.querySelector('.k-one-b') || {}).textContent?.trim() || null,
        pod: (v.el.querySelector('.k-one-p') || {}).textContent?.trim() || null,
        seznami: [...v.el.querySelectorAll('ul li')].map(x => x.textContent.trim())
      } : null
    });
  })()`;

  for (const pl of PLATNA) {
    /* Brez emulacije naprav, v oknu 1440x900 — isto kot dokazani rka-render.cjs.
       Emulation.setDeviceMetricsOverride je v treh zagonih naslikal črna platna
       (najprej cel :60, nato prvi kader), kljub pravilnemu DOM-u. */
    await sess("Emulation.clearDeviceMetricsOverride");
    await sess("Page.navigate", { url: `http://127.0.0.1:4183/${pl.dat}?render=1` });
    for (let i = 0; i < 80; i++) {
      if (await ev(`typeof seznam !== "undefined" && seznam.length > 0`)) break;
      await wait(150);
    }
    /* Vrata (uvodni zaslon, z=60) morajo zapreti — body.render jih NE skrije, zato
       slica brez tega koraka pokaže uvod, ne kadra. Prejšnji poskus je meril
       getComputedStyle().display in trdil, da so zaprta, medtem ko je bil na
       sredini platna še vedno uvodni tekst: zdaj merimo .hidden in NA KONCU
       dejansko pikslo na sredini (elementFromPoint). */
    const zapriVrata = async () => {
      for (let i = 0; i < 14; i++) {
        if (await ev(`document.getElementById('vrata').hidden === true`)) return true;
        await ev(`(() => { const g = document.getElementById('vBrezZvoka');
          if (!g) throw new Error("uvodnih vrat ni (#vBrezZvoka)"); g.click(); return 1; })()`);
        await wait(400);
      }
      return false;
    };
    if (!await zapriVrata()) throw new Error("uvodna vrata se niso zaprla");
    await ev(`ustavi(); nastaviRez(${JSON.stringify(pl.rez)}); nastaviJezik(${JSON.stringify(pl.jezik)}); 1`);
    await wait(2500);
    if (!await zapriVrata()) throw new Error("uvodna vrata so se vrnila ob preklopu");
    for (const id of pl.kadri) {
      /* Sled mid-pointu ni poljubno: kader se "usede" sele REZ_TRAJANJE po zacetku,
         zato cas vzamemo iz same strani, ne iz zunanje ure. */
      const s = await ev(`(() => {
        const v = seznam.find(w => w.id === ${JSON.stringify(id)});
        if (!v) throw new Error("kader " + ${JSON.stringify(id)} + " ni v enoti");
        const okno = v.konec - v.zacetek;
        return v.zacetek + Math.min(REZ_TRAJANJE * 1.15 + okno * 0.5, v.konec - 0.05);
      })()`);
      await ev(`(async () => {
        ustavi(); window.zadnjiCas = ${s.toFixed(3)}; izris(zadnjiCas);
        const v = seznam.find(w => w.id === ${JSON.stringify(id)});
        const slika = v.el.querySelector("img");
        if (slika) { if (!slika.complete)
          await Promise.race([slika.decode().catch(() => {}), new Promise(r => setTimeout(r, 3000))]);
          if (!(slika.complete && slika.naturalWidth > 0)) throw new Error("slika kadra ${id} ni dekodirana"); }
        const video = v.el.querySelector("video");
        if (video && video.readyState < 2) await new Promise(r => { video.addEventListener("loadeddata", r, { once: true }); setTimeout(r, 4000); });
        await document.fonts.ready;
        return 1;
      })()`);
      await wait(400);
      /* Tik pred posnetkom znova ustavimo in narišemo: nastaviJezik() na koncu
         asinhrono poklice predvajaj(0), katerega rAF zanka je v prejšnjem zagonu
         prepisala naš kader — zato je :60 ostal črn, :30 (kjer je bil zadnji klic
         naš) pa pravilen. Med tem klicem in posnetkom ni več čaka. */
      const mirno = JSON.parse(await ev(`(() => {
        ustavi();
        /* Brez GPU headless naslika ČRNA platna, dokler katerikoli <video> predvaja
           — v enoti :60 je prvi kader posnetek Kolpe, zato je bil cel :60 črn, :30
           (brez videa) pa pravilen. rka-render.cjs zato ustavi VSE videe. */
        document.querySelectorAll('.kader video').forEach(v => { v.pause(); });
        izris(${s.toFixed(3)});
        const v = seznam.find(w => w.id === ${JSON.stringify(id)});
        const el = document.elementFromPoint(720, 450);
        const slika = v.el.querySelector('img');
        const r = slika ? slika.getBoundingClientRect() : null;
        return JSON.stringify({
          predvaja: typeof predvaja !== 'undefined' ? predvaja : 'neznan',
          predvajajociVideoi: [...document.querySelectorAll('.kader video')].filter(x => !x.paused).length,
          kdo: el ? el.tagName + '#' + el.id + '.' + String(el.className).split(' ')[0] : null,
          vKadru: !!el && el.closest('.kader') === v.el,
          vNapisiH: !!el && !!el.closest('#napisi'),
          vUvodu: !!el && !!el.closest('#vrata'),
          aktivni: seznam.length ? seznam[indeksNa(${s.toFixed(3)})].id : null,
          slikaVidna: !!slika && slika.complete && slika.naturalWidth > 0 &&
                      r.width > 100 && r.height > 100 });
      })()`));
      if (mirno.predvaja !== false) throw new Error(`predvajanje se ni ustavilo (${mirno.predvaja})`);
      if (mirno.predvajajociVideoi > 0)
        throw new Error(`${mirno.predvajajociVideoi} video kadrov še predvaja — platno bi bilo črno`);
      if (mirno.aktivni !== id) throw new Error(`na sredini je kader ${mirno.aktivni}, ne ${id}`);
      if (!mirno.slikaVidna) throw new Error(`slika kadra ${id} ni naslikana (${JSON.stringify(mirno)})`);
      if (mirno.vUvodu || !(mirno.vKadru || mirno.vNapisiH))
        throw new Error(`na sredini ${pl.prefix} ${id} ni kadra, ampak ${mirno.kdo}`);
      console.log(`${pl.prefix} ${id} @${s.toFixed(2)}s  sredina=${mirno.kdo}`, await ev(PREBERI));
      await posnesi(`rka-${pl.prefix}-${id}.png`);
    }
  }

  /* --- spletna stran, kot jo vidi obiskovalec --- */
  for (const s of STRAN) {
    await sess("Emulation.setDeviceMetricsOverride",
      { width: s.z.w, height: s.z.h, deviceScaleFactor: s.z.dpr, mobile: s.z.mobil });
    await sess("Page.navigate", { url: `http://127.0.0.1:4183/index.html#${s.pog}` });
    for (let i = 0; i < 80; i++) {
      if (await ev("document.documentElement.classList.contains('pripravljen')")) break;
      await wait(150);
    }
    /* Vhodna animacija mora pasti: merimo in slikamo samo mirno stanje. */
    await wait(2500);
    const drsenje = JSON.parse(await ev(`JSON.stringify({
      g: __gostota.g, drsi: __gostota.drsi, izven: __gostota.izven,
      prelivi: document.getElementById('stage').scrollHeight - document.getElementById('stage').clientHeight })`));
    console.log(`${s.ime}`, JSON.stringify(drsenje));
    await posnesi(`rka-stran-${s.ime}.png`);
  }

})().catch(e => { console.error("NAPAKA:", e.message); process.exitCode = 1; })
  .finally(() => {
    for (const f of CISTI.reverse()) { try { f(); } catch {} }
    if (process.exitCode) process.exit(process.exitCode);
  });
