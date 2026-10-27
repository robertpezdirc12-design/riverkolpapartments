/* Vrata za pokončni (9:16) uvoz filma. Trdijo sedem reči, ki se jih da pokvariti
   vsako posebej:
   1) nacin gneta param, ne oblika okna: ?razmerje=9x16 vklopi body.pokonci,
      neznana vrednost pade na lezece;
   2) ziva stran se ne spremeni: brez parametra je .k-v se vedno 116 % platna na
      -8 %, ceprav je okno visoko in ozko — medijska poizvedba ne sme odpreti pasu;
   3) polnilo potuje s kadrom: vsak slikovni in videoski kader nosi --k-slika,
      zakljucna plosca ne;
   4) pas je konstanten: naslikani rob nikoli ne razkrije polnila levo ali desno,
      njegova spodnja meja pa ostane v pasu 55-65 % platna — pri vseh okvirjih,
      kjer se kader menja, in na sredini vsakega kadra;
   5) napis stoji na temnem polju: vrh naslova je pod pasom, noben napis se ne
      prelije cez rob platna ali cez sebe;
   6) pas ni crn: svetlost naslikanega pasu je nad pragom (zajema se umirja, ker
      prvi zajem po skoku v cas vrne staro kompozicijo);
   7) temno polje je temnejse od pasu — beli napis ima kontrast, ki ga zasnova
      obljublja.

   Uro postavlja izris(t), isto funkcijo kot izvoznik MP4. */
const { spawn, spawnSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const FFMPEG = "C:\\Users\\admin\\.qoder\\bin\\ffmpeg.exe";
const DOM = "C:\\Users\\admin\\Downloads\\sssdf\\rka-onepage";
const SIRINA = 1080, VISINA = 1920;
const wait = ms => new Promise(r => setTimeout(r, ms));

const TIP = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4", ".webp": "image/webp", ".jpg": "image/jpeg",
  ".woff2": "font/woff2", ".svg": "image/svg+xml", ".vtt": "text/vtt; charset=utf-8",
  ".m4a": "audio/mp4", ".png": "image/png", ".ico": "image/x-icon" };

function streznik(dir) {
  const httpSrv = http.createServer((req, res) => {
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
  return new Promise(res => httpSrv.listen(0, "127.0.0.1", () => res({
    vrata: httpSrv.address().port, zapri: () => new Promise(r => httpSrv.close(r)) })));
}

/* Svetlost pravokotnika v enih stevilkah: ffmpeg razreze in reducira na 1x1.
   Brez stevilk bi se "crno" in "temno" vsakic sodilo iz spomina na pogled. */
function svetlost(pot, x, y, w, h) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", pot,
    "-vf", `crop=${w}:${h}:${x}:${y},scale=1:1`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    { encoding: "buffer" });
  if (r.status !== 0 || r.stdout.length < 3) return null;
  return Math.round(0.2126 * r.stdout[0] + 0.7152 * r.stdout[1] + 0.0722 * r.stdout[2]);
}

const CISTI = [];
process.on("uncaughtException", e => {
  console.error("IZJEMA:", e.message);
  for (const f of CISTI) { try { f(); } catch {} }
  process.exit(2);
});

async function zazeniBrskalnik() {
  const profilDir = path.join(process.env.TEMP, `cdp-pokonci-${Date.now()}`);
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--mute-audio", "--autoplay-policy=no-user-gesture-required",
    "--force-device-scale-factor=1", "--font-render-hinting=none",
    `--window-size=${SIRINA},${VISINA}`, "--remote-debugging-port=0",
    `--user-data-dir=${profilDir}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
  CISTI.push(() => {
    try { spawnSync("taskkill", ["/T", "/F", "/PID", String(chrome.pid)], { stdio: "ignore" }); }
    catch { chrome.kill(); }
  });
  const datoteka = path.join(profilDir, "DevToolsActivePort");
  let vrata = null;
  for (let i = 0; i < 100 && !vrata; i++) {
    try {
      const prva = fs.readFileSync(datoteka, "utf-8").split("\n")[0].trim();
      if (prva) vrata = Number(prva);
    } catch { await wait(200); }
  }
  if (!vrata) throw new Error("DevToolsActivePort se ni pojavil v " + profilDir);
  let v;
  for (let i = 0; i < 50; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${vrata}/json/version`)).json(); break; }
    catch { await wait(400); }
  }
  if (!v) throw new Error("Chrome se ni zagnal na vratih " + vrata);
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  CISTI.push(() => { try { ws.close(); } catch {} });
  let stevec = 0;
  const odzivi = new Map();
  const send = (metoda, parametri = {}, sid) => new Promise((res, rej) => {
    const id = ++stevec;
    /* 30 s je enkrat že ubilo zagon: na programsko upodobljenem platnu
       1080 x 1920 CDP klic lahko traja minute. Rok je vodovod, ne trditev,
       zato je visek — prav cas zapiranja panela se meri in tiska posebej. */
    const t = setTimeout(() => { odzivi.delete(id); rej(new Error("prekoračen rok: " + metoda)); }, 90000);
    odzivi.set(id, { res, rej, t });
    ws.send(JSON.stringify({ id, method: metoda, params: parametri, sessionId: sid }));
  });
  ws.addEventListener("message", ev => {
    const o = JSON.parse(ev.data);
    if (o.id && odzivi.has(o.id)) {
      clearTimeout(odzivi.get(o.id).t);
      const { res, rej } = odzivi.get(o.id);
      odzivi.delete(o.id);
      o.error ? rej(new Error(o.error.message)) : res(o.result);
    }
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: sid } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sid);
  await send("Runtime.enable", {}, sid);
  await send("Emulation.setDeviceMetricsOverride",
    { width: SIRINA, height: VISINA, deviceScaleFactor: 1, mobile: false }, sid);
  const izvedi = async (izraz, cakaj = false) => {
    const r = await send("Runtime.evaluate", { expression: izraz, returnByValue: true, awaitPromise: cakaj }, sid);
    if (r.exceptionDetails) throw new Error("izraz se je sesul: " +
      ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || "").slice(0, 200));
    return r.result && r.result.value;
  };
  return { send, sid, targetId, izvedi };
}

/* Postavi uro in pocakaj, da je kader res aktivni; vrne geometrijo naslikanega
   pasu in napisa. Robovi kadrov so pomembni, ker se tam menja slika — tam se
   mosti najlazje pokaze. */
const ZONDA = t => `(async () => {
  izris(${t});
  const aktivni = seznam.find(w => ${t} >= w.zacetek && ${t} < w.konec) || seznam[seznam.length - 1];
  const e = aktivni.el;
  const medij = e.querySelector('img, video');
  const gib = e.querySelector('.k-v');
  const napisEl = aktivni.napisEl && aktivni.napisEl.classList.contains('vidno') ? aktivni.napisEl : null;
  const r = x => { if (!x) return null; const b = x.getBoundingClientRect();
    return { l: +b.left.toFixed(1), z: +b.top.toFixed(1), desno: +b.right.toFixed(1),
             s: +b.bottom.toFixed(1), visina: +b.height.toFixed(1), sirina: +b.width.toFixed(1) }; };
  const naslov = document.querySelector('.napis.vidno .n-naslov');
  return {
    pokonci: document.body.classList.contains('pokonci'),
    razmerje: stanje.razmerje,
    kader: aktivni.kader.id, vrsta: aktivni.kader.vrsta,
    polnilo: (getComputedStyle(e).getPropertyValue('--k-slika') || '').trim(),
    gib: gib ? { sirina: +getComputedStyle(gib).width.replace('px',''),
                 visina: +getComputedStyle(gib).height.replace('px',''),
                 levo: +getComputedStyle(gib).left.replace('px','') } : null,
    pas: r(medij),
    napis: r(napisEl),
    naslov: naslov ? { prelit: naslov.scrollWidth - naslov.clientWidth,
                       visPreLit: naslov.scrollHeight - naslov.clientHeight,
                       velikost: +parseFloat(getComputedStyle(naslov).fontSize).toFixed(1) } : null,
    napisBes: napisEl ? (napisEl.querySelector('.n-naslov') || {}).textContent : null
  };
})()`;

/* Tocke vzorcenja: rob vsakega kadra in njegova sredina. Robovi so nujno
   notri, ker se tam menja slika — zamenjava kadra je edini trenutek, ko lahko
   pas skoči. Sredina je nujno notri, ker ima vsak kader svoj Ken Burnsov
   premik in je na sredini ta najdalj od izhodišča. */
const TOCKE = `(seznam.flatMap(v => [v.zacetek, +((v.zacetek + v.konec) / 2).toFixed(3)])
  .filter((x, i, a) => x < SPOT.rezi[stanje.rez].dolzina && a.indexOf(x) === i))`;
/* Svetlost se meri na kadrih, ki imajo pas: zakljucna plosca je namerno temna,
   prvi videoski kader pa se iskati začne šele ob naslednjem zagonu. */
const SVETLOBNE_TOCKE = `(() => { const k = seznam.filter(v => v.kader.vrsta === 'slika');
  const i = [1, Math.floor(k.length / 2), k.length - 2].map(x => Math.max(0, Math.min(k.length - 1, x)));
  return [...new Set(i)].map(x => +(((k[x].zacetek + k[x].konec) / 2).toFixed(3))); })()`;

const NAPAKE = [];
function trdi(pogoj, spor) { if (!pogoj) NAPAKE.push(spor); }

(async () => {
  const srv = await streznik(DOM);
  CISTI.push(() => srv.zapri());

  /* ---------- 1 in 2: ziva stran brez parametra ---------- */
  const zivi = await zazeniBrskalnik();
  await zivi.send("Page.navigate", { url: `http://127.0.0.1:${srv.vrata}/zgodba.html?render=1`, }, zivi.sid);
  for (let i = 0; i < 80; i++) {
    if (await zivi.izvedi(`typeof SPOT === 'object' && SPOT !== null && seznam.length > 0`)) break;
    await wait(250);
  }
  const ziviS = await zivi.izvedi(ZONDA(1.641), true);
  console.log(`\n=== ziva stran (brez parametra, okno ${SIRINA}x${VISINA}) ===`);
  console.log(`  body.pokonci=${ziviS.pokonci} razmerje=${ziviS.razmerje} sirina .k-v=${ziviS.gib && ziviS.gib.sirina} levi rob=${ziviS.gib && ziviS.gib.levo}`);
  console.log(`  naslov k01: vodorivni prelit ${ziviS.naslov && ziviS.naslov.prelit}px, navpicni ${ziviS.naslov && ziviS.naslov.visPreLit}px pri ${(ziviS.naslov || {}).velikost}px pisavi (lezeci dizajn je odobren tak)`);
  trdi(ziviS.pokonci === false, "ziva stran: body.pokonci je nastavljen brez parametra — ozko okno samo odpre pokoncni pas.");
  trdi(ziviS.razmerje === "16x9", `ziva stran: stanje.razmerje je "${ziviS.razmerje}", ne "16x9".`);
  /* Lezeca zasnova: .k-v sega 8 % cez platno na vsaki strani. Ce se ta stevilka
     spremeni, je nov pokoncni slog posegel v izdelek, ki ga je Robert odobril. */
  trdi(Math.abs(ziviS.gib.sirina - SIRINA * 1.16) < 1.5,
    `ziva stran: .k-v je širok ${ziviS.gib.sirina}px, lezeca zasnova obljublja ${(SIRINA * 1.16).toFixed(0)}px.`);
  trdi(Math.abs(ziviS.gib.levo + SIRINA * 0.08) < 1.5,
    `ziva stran: .k-v zacne na ${ziviS.gib.levo}px, lezeca zasnova na ${(-SIRINA * 0.08).toFixed(0)}px.`);
  await zivi.send("Target.closeTarget", { targetId: zivi.targetId }, zivi.sid).catch(() => {});

  /* ---------- 1: neznana vrednost ne odpre nic ---------- */
  const tuj = await zazeniBrskalnik();
  await tuj.send("Page.navigate", { url: `http://127.0.0.1:${srv.vrata}/zgodba.html?render=1&razmerje=4x3`, }, tuj.sid);
  for (let i = 0; i < 80; i++) {
    if (await tuj.izvedi(`typeof SPOT === 'object' && SPOT !== null && seznam.length > 0`)) break;
    await wait(250);
  }
  const tujS = await tuj.izvedi(ZONDA(8), true);
  console.log(`\n=== neznano razmerje (?razmerje=4x3) ===`);
  console.log(`  body.pokonci=${tujS.pokonci} razmerje=${tujS.razmerje}`);
  trdi(tujS.pokonci === false && tujS.razmerje === "16x9",
    `neznano razmerje: stran je pristala v "${tujS.razmerje}" (pokonci=${tujS.pokonci}); neznana vrednost mora pasti na lezece.`);
  await tuj.send("Target.closeTarget", { targetId: tuj.targetId }, tuj.sid).catch(() => {});

  /* ---------- 3-5: pokoncni nacin cez cel casovni list ---------- */
  const p = await zazeniBrskalnik();
  await p.send("Page.navigate", { url: `http://127.0.0.1:${srv.vrata}/zgodba.html?render=1&razmerje=9x16`, }, p.sid);
  for (let i = 0; i < 80; i++) {
    if (await p.izvedi(`typeof SPOT === 'object' && SPOT !== null && seznam.length > 0`)) break;
    await wait(250);
  }
  await p.izvedi(`(() => { const g = document.getElementById('vBrezZvoka'); if (!g) throw new Error('gated ni na voljo'); g.click(); return 1; })()`);
  /* Panel se zapre s 480-ms timerjem (zgodba.js:515), a pod programskim
     upodabljanjem (platno 1080 x 1920 brez GPU, dva Chroma naenkrat) se ta
     timer lahko zavleče v sekunde. Fiksna meja 10 s je enkrat že ubila vrata
     sproti — SMRT, ki ni razsodba — zato rok zdaj meri čas in ob zamudi izpiše
     stanje, da se loči "stran se nikoli ne zapre" od "stran se je zaprela
     pozno". Porabljen čas se tiska vedno: zamuda, ki se ne vidi, je naslednja
     SMRT. */
  const zaprtOD = Date.now();
  let zaprtV = null;
  for (let i = 0; i < 400 && zaprtV === null; i++) {
    if (await p.izvedi(`document.getElementById('vrata').hidden === true`)) zaprtV = Date.now() - zaprtOD;
    else await wait(250);
  }
  if (zaprtV === null) {
    const stanje = await p.izvedi("(() => { const v = document.getElementById('vrata');" +
      "return v ? 'skrit=' + v.hidden + ' razredi=' + v.className +" +
      " (typeof seznam === 'object' ? ' seznam=' + seznam.length : ' seznama ni')" +
      " : 'panela ni'; })()");
    throw new Error(`vrata se ne zaprejo v 60 s (${stanje}) — meritev pokoncnega nacina ne more poteci`);
  }
  console.log(`  pokoncni panel zaprt po ${(zaprtV / 1000).toFixed(2)} s (rok 60 s)`);
  await p.izvedi(`ustavi(); 1`);
  await p.izvedi(`(async () => { await document.fonts.ready; return 1; })()`, true);
  await p.izvedi(`(() => { const s = [...document.querySelectorAll('.kader img')];
    return Promise.all(s.map(i => i.decode().catch(() => 0))); })()`, true);

  for (const rez of ["60", "30"]) {
    await p.izvedi(`nastaviRez(${JSON.stringify(rez)}); 1`);
    await p.izvedi(`(async () => { await document.fonts.ready;
      const s = [...document.querySelectorAll('.kader img')];
      await Promise.all(s.map(i => i.decode().catch(() => 0)));
      [...document.querySelectorAll('.kader video')].forEach(v => v.pause());
      return s.length; })()`, true);

    /* ---------- 3-5: geometrija cez cel casovni list ---------- */
    const tocke = await p.izvedi(TOCKE);
    console.log(`\n=== pokoncni nacin :${rez} — ${tocke.length} vzorcev po casovnem listu ===`);
    let robRazkrit = null, pasPremajhen = null, napisVPasu = null, polniloManjka = null, prelit = null;
    const sirinePasa = [], spodnjiRobi = [];
    for (const t of tocke) {
      const s = await p.izvedi(ZONDA(t), true);
      if (!s.pokonci) { trdi(false, `:${rez} t=${t}: med vzorcenjem je pokoncni nacin izginil.`); break; }
      if (s.vrsta !== "zakljucek") {
        if (!s.polnilo.startsWith("url(")) polniloManjka = polniloManjka || s.kader;
        if (s.pas) {
          sirinePasa.push(s.pas.sirina);
          spodnjiRobi.push(s.pas.s);
          /* Rob sme ostati znotraj platna samo toliko, kolikor ga pogoltne senca;
             ce ga ni, se vidi polnilo — to je past vodoravnega premika. */
          if (s.pas.l > -4 || s.pas.desno < SIRINA + 4) robRazkrit = robRazkrit || { t, kader: s.kader, l: s.pas.l, d: s.pas.desno };
          const delezh = s.pas.s / VISINA;
          if (delezh < 0.55 || delezh > 0.65) pasPremajhen = pasPremajhen || { t, kader: s.kader, delezh: +delezh.toFixed(3) };
        } else pasPremajhen = pasPremajhen || { t, kader: s.kader, delezh: "ni medija" };
        if (s.napis && s.pas && s.napis.z < s.pas.s - 2) napisVPasu = napisVPasu || { t, kader: s.kader, z: s.napis.z, pas: s.pas.s };
      } else if (s.polnilo.startsWith("url(")) {
        trdi(false, `:${rez} zakljucna plosca ${s.kader} nosi polnilo — pas bi mel sliko pod besedilom.`);
      }
      /* Navpicni "prelit" pri lezecem naslovni pisavi ni napaka: Cormorantov
       leznik zraste cez svojo vrstico za odstetek velikosti, enako pri obeh
       razmerjih (izmerjeno 2 px pri 40 px, 5 px pri 74 px). Zato se meri kot
       delez velikosti — pravi prelitje ali odrezan napis bi bila stevilka, ki je
       veckratnik vrstice, ne odstetek. */
      if (s.naslov && (s.naslov.prelit > 1 ||
          s.naslov.visPreLit / s.naslov.velikost > 0.10))
        prelit = prelit || { t, kader: s.kader, ...s.naslov, delez: +(s.naslov.visPreLit / s.naslov.velikost).toFixed(3), bes: s.napisBes };
      if (s.napis && (s.napis.l < -1 || s.napis.desno > SIRINA + 1 || s.napis.s > VISINA + 1))
        prelit = prelit || { t, kader: s.kader, izven: s.napis };
    }
    trdi(!polniloManjka, `:${rez} polnilo --k-slika manjka na kadru ${polniloManjka} — pas bi bil nad črno podlago.`);
    trdi(!robRazkrit, `:${rez} pas razkrije polnilo ob t=${robRazkrit && robRazkrit.t}s (kader ${robRazkrit && robRazkrit.kader}, robova ${robRazkrit && robRazkrit.l}/${robRazkrit && robRazkrit.d}).`);
    trdi(!pasPremajhen, `:${rez} pas ni konstanten ob t=${pasPremajhen && pasPremajhen.t}s (kader ${pasPremajhen && pasPremajhen.kader}, spodnji rob ${pasPremajhen && pasPremajhen.delezh} platna).`);
    trdi(!napisVPasu, `:${rez} napis sega v pas ob t=${napisVPasu && napisVPasu.t}s (kader ${napisVPasu && napisVPasu.kader}, vrh ${napisVPasu && napisVPasu.z} nad robom ${napisVPasu && napisVPasu.pas}).`);
    trdi(!prelit, `:${rez} napis se prelije ob t=${prelit && prelit.t}s (kader ${prelit && prelit.kader}: ${JSON.stringify(prelit)}).`);
    if (sirinePasa.length) {
      console.log(`  sirina pasu: ${Math.min(...sirinePasa).toFixed(0)}–${Math.max(...sirinePasa).toFixed(0)}px (platno ${SIRINA})`);
      console.log(`  spodnji rob pasu: ${(Math.min(...spodnjiRobi) / VISINA * 100).toFixed(1)}–${(Math.max(...spodnjiRobi) / VISINA * 100).toFixed(1)} % platna`);
    }

    /* ---------- 6 in 7: svetlost, izmerjena na naslikani sliki ---------- */
    /* DOM pove, kaj je bilo nastavljeno; zajem pove, kaj je res na platnu.
       Zajem se ponavlja, dokler se svetlost ne ustali: prvi zajem po skoku v cas
       vrne staro kompozicijo. */
    const zajemi = async () => {
      const { data } = await p.send("Page.captureScreenshot",
        { format: "png", clip: { x: 0, y: 0, width: SIRINA, height: VISINA, scale: 1 } }, p.sid);
      return Buffer.from(data, "base64");
    };
    const pasZg = Math.round(VISINA * 0.06), pasSpodaj = Math.round(VISINA * 0.60);
    let crniPas = null, svetloPolje = null;
    for (const t of await p.izvedi(SVETLOBNE_TOCKE)) {
      await p.izvedi(`izris(${t}); 1`);
      let prejsnja = null, pot = null, svetPas = null, korakov = 0;
      for (; korakov < 12; korakov++) {
        pot = path.join(process.env.TEMP, `rka-vrata-${rez}-${String(t).replace(".", "_")}.png`);
        fs.writeFileSync(pot, await zajemi());
        const z = svetlost(pot, 0, pasZg, SIRINA, pasSpodaj - pasZg);
        const umirjena = prejsnja !== null && Math.abs(z - prejsnja) <= 2;
        prejsnja = z; svetPas = z;
        if (umirjena) break;
        await wait(500);
      }
      if (korakov >= 12) trdi(false, `:${rez} t=${t}: zajem se ni umiril v 12 poskusih (nazadnje svetlost ${prejsnja}).`);
      const polje = svetlost(pot, 0, pasSpodaj, SIRINA, VISINA - pasSpodaj);
      console.log(`  t=${t}  pas=${svetPas}  temno polje=${polje}`);
      if (svetPas !== null && svetPas < 40) crniPas = crniPas || { t, svetPas };
      if (polje !== null && svetPas !== null && polje >= svetPas) svetloPolje = svetloPolje || { t, polje, svetPas };
    }
    trdi(!crniPas, `:${rez} pas je crn ob t=${crniPas && crniPas.t}s (svetlost ${crniPas && crniPas.svetPas} < 40) — slika se ne nališe.`);
    trdi(!svetloPolje, `:${rez} temno polje ni temnejse od pasu ob t=${svetloPolje && svetloPolje.t}s (${svetloPolje && svetloPolje.polje} >= ${svetloPolje && svetloPolje.svetPas}) — beli napis nima kontrasta.`);
  }

  console.log("\n--- presoja ---");
  for (const n of NAPAKE) console.log("  NAP: " + n);
  console.log(NAPAKE.length ? "NI V REDU" :
    "V REDU: pokoncni nacin gane samo parameter, ziva stran je nespremenjena, pas je konstanten in natihoma svetel, napis stoji na temnem polju.");
  process.exitCode = NAPAKE.length ? 1 : 0;
})().catch(e => { console.error("SMRT:", e.message); process.exitCode = 2; })
  .finally(() => {
    for (const f of CISTI) { try { f(); } catch {} }
    setTimeout(() => process.exit(process.exitCode || 0), 300);
  });
