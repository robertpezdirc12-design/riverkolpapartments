/* Vrata za podnapise na strani zgodbe. Trdijo štiri reči, ki jih je treba ločiti:
   1) pripovedni sledi so res brskalniški <track kind="captions">, ne self-made
      seznam; njegov srclang in datoteka sledita rezoma in jeziku,
   2) vidna crta izpiše TOČNO tisto besedilo, ki ga v isti sekundi trdi datoteka
      .vtt na disku — pričakovanja jemljemo iz datoteke, ne iz kode strani,
   3) v praznikih med sledmi in pred prvo ter za zadnjo crta molči,
   4) crta je opt-in: brez poziva je ne vidi nihče, niti izvoznik (?render=1).

   Uro postavlja izris(t), isto funkcijo kot izvoznik MP4, zato meritev ne čaka na
   predvajanje in ne more zaiti v prehod. */
const { spawn, spawnSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DOM = "C:\\Users\\admin\\Downloads\\sssdf\\rka-onepage";
const wait = ms => new Promise(r => setTimeout(r, ms));

const TIP = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4", ".webp": "image/webp", ".jpg": "image/jpeg",
  ".woff2": "font/woff2", ".svg": "image/svg+xml", ".vtt": "text/vtt; charset=utf-8",
  ".wav": "audio/wav", ".m4a": "audio/mp4", ".png": "image/png", ".ico": "image/x-icon" };

function streznik(dir) {
  const httpSrv = http.createServer((req, res) => {
    let pot = decodeURIComponent(req.url.split("?")[0]);
    if (pot === "/") pot = "/zgodba.html";
    const datoteka = path.join(dir, pot);
    if (!datoteka.startsWith(path.resolve(dir)) || !fs.existsSync(datoteka)) {
      res.writeHead(404); res.end("ni"); return;
    }
    const veljavna = fs.statSync(datoteka);
    res.writeHead(200, { "Content-Type": TIP[path.extname(datoteka).toLowerCase()] || "application/octet-stream",
      "Content-Length": String(veljavna.size), "Cache-Control": "no-store" });
    fs.createReadStream(datoteka).pipe(res);
  });
  return new Promise(res => httpSrv.listen(0, "127.0.0.1", () => res({
    vrata: httpSrv.address().port,
    zapri: () => new Promise(r => httpSrv.close(r))
  })));
}

/* --- priča: .vtt neposredno z diska --- */
/* Sled se bere po blokih, ne z regularnim izrazom čez celotno datoteko:
   večvrstična sled je en sam podnapis, ne več. Prelom vrstice v .vtt je
   navodilo za postavitev, ne besedilo — zato ga priča zlepi z presledkom,
   preden sploh začne primerjati. */
function sekunde(x) { const [h, m, s] = x.split(":"); return +h * 3600 + +m * 60 + +s; }
function preberiVtt(pot) {
  const besedilo = fs.readFileSync(pot, "utf-8");
  const sledi = [];
  for (const blok of besedilo.split(/\r?\n[\t ]*\r?\n/)) {
    const vrstice = blok.split(/\r?\n/);
    const cas = vrstice.findIndex(v => /-->/.test(v));
    if (cas === -1) continue;
    const [z, k] = vrstice[cas].split("-->").map(s => s.trim().split(" ")[0]);
    const text = vrstice.slice(cas + 1).map(s => s.trim()).filter(Boolean).join(" ");
    if (!text) continue;
    sledi.push({ zacetek: sekunde(z), konec: sekunde(k), besedilo: text });
  }
  if (!sledi.length) throw new Error("iz .vtt ni bilo mogoče izvleči nobene sledi: " + pot);
  return sledi;
}
function pricakuj(sledi, t) {
  return sledi.filter(k => t >= k.zacetek && t < k.konec)
              .map(k => k.besedilo).join(" · ");
}
/* Vzorci: sredina vsake sledi, sredina vsakega praznika, nič pred prvo in nič
   za zadnjo. Robovi so izpuščeni namerno — na robu se lahko prepirata dve
   implikaciji, notranjost pa ne.
   Zadnja sled tega spota se konča čisto na konce reza (60.000 / 30.000), zato
   "malo za zadnjo" pade ven in ga ura spota itak ne more doseči. Kjer praznine
   po zadnji sledi ni, se namesto nje vzorči sam konec reza: z datumom iz
   datoteje, kjer se upa še besedilo, in z enako sekundo na strani. */
function vzorci(sledi, enota) {
  const tocke = [];
  for (const k of sledi) tocke.push({ t: +((k.zacetek + k.konec) / 2).toFixed(3), vrsta: "sled" });
  const praznine = [];
  if (sledi[0].zacetek > 0.05) praznine.push(+(sledi[0].zacetek / 2).toFixed(3));
  for (let i = 1; i < sledi.length; i++) {
    const r = sledi[i].zacetek - sledi[i - 1].konec;
    if (r > 0.05) praznine.push(+(sledi[i - 1].konec + r / 2).toFixed(3));
  }
  const zadnja = sledi[sledi.length - 1];
  if (zadnja.konec + 0.02 < enota) praznine.push(+(zadnja.konec + 0.02).toFixed(3));
  else if (zadnja.konec >= enota) tocke.push({ t: enota, vrsta: "konec-reza" });
  for (const t of praznine) tocke.push({ t, vrsta: "prazno" });
  return tocke;
}

const ZONDA = t => `(() => {
  izris(${t});
  const el = document.getElementById('podnapis');
  const tr = document.querySelector('#zvok track');
  return {
    besedilo: (el.textContent || '').trim(),
    prikazano: getComputedStyle(el).display !== 'none',
    vklopljeno: document.body.classList.contains('podnapisi-on'),
    tisk: getComputedStyle(el).display,
    sled: tr ? { kind: tr.kind, srclang: tr.srclang, label: tr.label, src: tr.src,
                 nacin: tr.track ? tr.track.mode : '?',
                 n: tr.track && tr.track.cues ? tr.track.cues.length : -1 } : null
  };
})()`;

const CISTI = [];
process.on("uncaughtException", e => {
  console.error("IZJEMA:", e.message);
  for (const f of CISTI) { try { f(); } catch {} }
  process.exit(2);
});

async function zazeniBrskalnik(extraZastavice = []) {
  const profilDir = path.join(process.env.TEMP, `cdp-podnapisi-${Date.now()}`);
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--mute-audio", "--autoplay-policy=no-user-gesture-required",
    "--force-device-scale-factor=1", "--window-size=1440,900",
    "--remote-debugging-port=0", `--user-data-dir=${profilDir}`,
    "--no-first-run", "about:blank"].concat(extraZastavice), { stdio: "ignore" });
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
  const dog = new Map();
  const send = (metoda, parametri = {}, sid) => new Promise((res, rej) => {
    const id = ++stevec;
    const t = setTimeout(() => { odzivi.delete(id); rej(new Error("prekoračen rok: " + metoda)); }, 30000);
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
    } else if (o.method) {
      const k = (o.sessionId || "") + "|" + o.method;
      dog.set(k, (dog.get(k) || 0) + 1);
    }
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: sid } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sid);
  await send("Runtime.enable", {}, sid);
  await send("Emulation.setDeviceMetricsOverride",
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sid);
  return { send, dog, sid, targetId };
}

async function izvedi(send, sid, izraz) {
  const r = await send("Runtime.evaluate", { expression: izraz, returnByValue: true }, sid);
  if (r.exceptionDetails) throw new Error("izraz se je sesul: " +
    (r.exceptionDetails.exception && r.exceptionDetails.exception.description || "").slice(0, 160));
  return r.result && r.result.value;
}

const NAPAKE = [];
function trdi(pogoj, spor) { if (!pogoj) NAPAKE.push(spor); }

(async () => {
  const srv = await streznik(DOM);
  CISTI.push(() => srv.zapri());
  const { send, dog, sid, targetId } = await zazeniBrskalnik();

  await send("Page.navigate", { url: `http://127.0.0.1:${srv.vrata}/zgodba.html`, }, sid);
  const doLoad = Date.now();
  while (Date.now() < doLoad + 20000 && !(dog.get(sid + "|Page.loadEventFired") > 0)) await wait(150);
  /* spot.json se nabira s fetchom, brez njega platno nima kadrov. */
  for (let i = 0; i < 60; i++) {
    const pripravljeno = await izvedi(send, sid, `typeof SPOT === 'object' && SPOT !== null && seznam.length > 0`);
    if (pripravljeno) break;
    await wait(250);
  }

  for (const rez of ["60", "30"]) {
    for (const jezik of ["sl", "en"]) {
      const datoteka = `podnapisi/rka-${rez}-${jezik}-splet.vtt`;
      const sledi = preberiVtt(path.join(DOM, datoteka));
      await izvedi(send, sid, `nastaviRez(${JSON.stringify(rez)}); 1`);
      await izvedi(send, sid, `nastaviJezik(${JSON.stringify(jezik)}); 1`);
      /* Meja vzorcev je ura strani, ne tabela v vratih: sicer bi vzorec padel
         zunaj zadnjega okvirja, film pa takega nikoli ne pokaže. */
      const enota = await izvedi(send, sid, `SPOT.rezi[stanje.rez].dolzina`);
      const vzorciTi = vzorci(sledi, enota);
      /* Sled mora biti naložena, sicer bi primerjali prazno okno z datoteko. */
      let z = null;
      for (let i = 0; i < 80; i++) {
        z = await izvedi(send, sid, ZONDA(0));
        if (z && z.sled && z.sled.n === sledi.length) break;
        await wait(200);
      }
      console.log(`\n=== :${rez} ${jezik} — ${datoteka} (${sledi.length} sledi, ${vzorciTi.length} vzorcev) ===`);
      if (!z || !z.sled) { trdi(false, `:${rez} ${jezik}: na zvoku ni nobene <track> sledi.`); continue; }
      if (z.sled.n !== sledi.length) {
        trdi(false, `:${rez} ${jezik}: sled je naložila ${z.sled.n} od ${sledi.length} cue-jev iz datoteke.`);
        continue;
      }
      const cisti = datoteka.split("/").pop();
      trdi(z.sled.kind === "captions", `:${rez} ${jezik}: vrsta sledi je "${z.sled.kind}", ne "captions".`);
      trdi(z.sled.srclang === jezik, `:${rez} ${jezik}: srclang je "${z.sled.srclang}".`);
      trdi(z.sled.src.endsWith(cisti), `:${rez} ${jezik}: sled kaže na drugo datoteko (${z.sled.src}).`);
      trdi(z.sled.nacin === "hidden", `:${rez} ${jezik}: način sledi je "${z.sled.nacin}", pričakovan "hidden".`);

      /* Brez poziva nihče ne vidi crte — tudi ne izvoznik. */
      const brezPoziva = await izvedi(send, sid, ZONDA(sledi[0].zacetek + 0.2));
      trdi(!brezPoziva.vklopljeno && brezPoziva.besedilo === "" && !brezPoziva.prikazano,
        `:${rez} ${jezik}: crta je vidna brez poziva, podnapisi niso opt-in.`);

      await izvedi(send, sid, `preklopiPodnapise(true); 1`);
      const pri = await izvedi(send, sid, ZONDA(0));
      trdi(pri.vklopljeno && pri.prikazano,
        `:${rez} ${jezik}: crta je skrita, čeprav je vklopljena (prikaz "${pri.tisk}").`);

      let napacni = 0;
      for (const v of vzorciTi) {
        /* Enaka omejitev ure kot v zgodba.js:229 — sicer bi vzorec trdil, da je
           zunaj filma, stran pa ga vedno vrne na zadnji okvir. */
        const t = Math.min(enota, Math.max(0, v.t));
        const rezultat = await izvedi(send, sid, ZONDA(t));
        const pričakovano = pricakuj(sledi, t);
        if (rezultat.besedilo !== pričakovano) {
          napacni++;
          if (napacni <= 3) {
            console.log(`  NAP: t=${t.toFixed(3)}s (${v.vrsta})`);
            console.log(`       v datoteki: "${pričakovano}"`);
            console.log(`       na strani : "${rezultat.besedilo}"`);
          }
        }
        if (v.vrsta === "prazno" && rezultat.besedilo !== "") {
          trdi(false, `:${rez} ${jezik}: v praznosti ob ${t.toFixed(2)}s je crta zapisala "${rezultat.besedilo}".`);
        }
        if (v.vrsta === "konec-reza" && rezultat.besedilo !== "") {
          trdi(false, `:${rez} ${jezik}: ob koncu reza (${t.toFixed(3)}s) crta še vedno piše "${rezultat.besedilo}".`);
        }
        if (v.vrsta === "sled" && !rezultat.prikazano) {
          trdi(false, `:${rez} ${jezik}: ob ${t.toFixed(2)}s je besedilo tam, crta pa je skrita.`);
        }
      }
      trdi(napacni === 0, `:${rez} ${jezik}: ${napacni}/${vzorciTi.length} vzorcev se ne ujema z datoteko.`);

      /* Jezik mora veljati: sicer bi angleški film nosil slovensko besedilo. */
      const prevod = await izvedi(send, sid, ZONDA(sledi[0].zacetek + 0.2));
      if (jezik === "en") {
        trdi(/[A-Za-z]{4}/.test(prevod.besedilo) && !/[čšž]/.test(prevod.besedilo),
          `:60 en: po preklopu na angleščino crta ne piše angleško ("${prevod.besedilo}").`);
      }

      await izvedi(send, sid, `preklopiPodnapise(false); 1`);
      const ven = await izvedi(send, sid, ZONDA(sledi[0].zacetek + 0.2));
      trdi(!ven.vklopljeno && ven.besedilo === "" && !ven.prikazano,
        `:${rez} ${jezik}: izklop crte ne počisti besedila ali razreda.`);
      console.log(`  ujemanje: ${vzorciTi.length - napacni}/${vzorciTi.length} vzorcev, sled ${z.sled.n} cue-jev, ${cisti}`);
    }
  }

  /* Izvoznik dela z ?render=1 in ne pozna gumbov — tam mora crta ostati tiha. */
  await send("Target.closeTarget", { targetId }, sid).catch(() => {});
  const drugi = await zazeniBrskalnik();
  await drugi.send("Page.navigate", { url: `http://127.0.0.1:${srv.vrata}/zgodba.html?render=1` }, drugi.sid);
  const t0 = Date.now();
  while (Date.now() < t0 + 20000 && !(drugi.dog.get(drugi.sid + "|Page.loadEventFired") > 0)) await wait(150);
  for (let i = 0; i < 60; i++) {
    if (await izvedi(drugi.send, drugi.sid, `typeof SPOT === 'object' && SPOT !== null && seznam.length > 0`)) break;
    await wait(250);
  }
  const renderStanje = await izvedi(drugi.send, drugi.sid, ZONDA(1.0));
  trdi(!renderStanje.vklopljeno && renderStanje.besedilo === "" && !renderStanje.prikazano,
    "?render=1: izvoznik bi posnel podnapis, ki ga v zasnovi MP4 ni.");
  const renderRazred = await izvedi(drugi.send, drugi.sid, `document.body.classList.contains('render')`);
  trdi(renderRazred === true, "?render=1: razred render se ni nastavil, izvoznik ni prepoznan.");
  await drugi.send("Target.closeTarget", { targetId: drugi.targetId }, drugi.sid).catch(() => {});
  console.log(`\nizvoz (?render=1): crta ${renderStanje.prikazano ? "VIDNA" : "skrita"}, besedilo "${renderStanje.besedilo}"`);

  console.log("\n--- presoja ---");
  for (const n of NAPAKE) console.log("  NAP: " + n);
  console.log(NAPAKE.length ? "NI V REDU" : "V REDU: sled je prava, crta ujema datoteko, prazniki molčijo, izvoz ne vidi ničesar.");
  process.exitCode = NAPAKE.length ? 1 : 0;
})().catch(e => { console.error("SMRT:", e.message); process.exitCode = 2; })
  .finally(() => {
    for (const f of CISTI) { try { f(); } catch {} }
    setTimeout(() => process.exit(process.exitCode || 0), 300);
  });
