/* Vrata za hero ozadje. Merita dve trditvi, ki ju namen v kodi obljublja:
   A) kadar YouTube steče, se lokalni mp4 NE prenese (prihranek ~1 MB);
   B) kadar YouTube ni dosegljiv, se lokalni mp4 VSEENO zavrti — rezerva živi.

   Zakaj strežnik šteje bite: CDP je za pas, ki je posnetek očitno predvajal do
   11,7 s, javil 0 KB, Resource Timing pa enako. Karkoli trdi brskalnik, je priča
   samo strežnik.

   Zakaj YouTube ni več pravi: prejšnja različica je čakala na resnično zanko, ta
   je prišla pri 6068 ms, rok pa je bil 6000 ms. Odločitev kode lahko merimo šele,
   ko je časovnica v naših rokah, zato IFrame API presreže Fetch.fulfillRequest in
   player javi PLAYING točno takrat, kot mu naročimo. Prisotni so trije obrati:
   hitra zmaga, zmaga tik pred rokom (tu se je poznal nepreklčan rok) in nikoli.
   Resnično blokirano povezavo ima še vedno svoj pas, ker je edini dokaz,
   da pot onerror ne izpusti rezerve. Vsak pas dobi svoj strežnik in svoj profil
   brskalnika, da predpomnilnik ne more podtreti meritve. */
const { spawn, spawnSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DOM = "C:\\Users\\admin\\Downloads\\sssdf\\rka-onepage";
const BAZ = `${process.env.TEMP}\\rka-baz`;
const wait = ms => new Promise(r => setTimeout(r, ms));

const TIP = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4", ".webp": "image/webp", ".jpg": "image/jpeg",
  ".woff2": "font/woff2", ".svg": "image/svg+xml", ".vtt": "text/vtt; charset=utf-8",
  ".wav": "audio/wav", ".m4a": "audio/mp4", ".png": "image/png", ".ico": "image/x-icon" };

function streznik(dir, port) {
  const odposlano = new Map();
  const httpSrv = http.createServer((req, res) => {
    let pot = decodeURIComponent(req.url.split("?")[0]);
    if (pot === "/") pot = "/index.html";
    const datoteka = path.join(dir, pot);
    if (!datoteka.startsWith(path.resolve(dir)) || !fs.existsSync(datoteka)) {
      res.writeHead(404); res.end("ni"); return;
    }
    const veljavna = fs.statSync(datoteka);
    const glave = { "Content-Type": TIP[path.extname(datoteka).toLowerCase()] || "application/octet-stream",
      "Accept-Ranges": "bytes", "Content-Length": String(veljavna.size) };
    const obseg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    let zacetek = 0, konec = veljavna.size - 1, kod = 200;
    if (obseg) {
      zacetek = obseg[1] ? +obseg[1] : 0;
      if (obseg[2]) konec = +obseg[2];
      if (obseg[1] && !obseg[2]) konec = veljavna.size - 1;
      if (zacetek > konec || konec >= veljavna.size) { res.writeHead(416, {
        "Content-Range": `bytes */${veljavna.size}` }); res.end(); return; }
      kod = 206;
      glave["Content-Range"] = `bytes ${zacetek}-${konec}/${veljavna.size}`;
      glave["Content-Length"] = String(konec - zacetek + 1);
    }
    res.writeHead(kod, glave);
    /* Stream.bytesRead je pošteno število: če brskalnik odziv prekine, se ustavi
       pri zadnjem kosu, ki ga je brskalnik res vzel. */
    const tok = fs.createReadStream(datoteka, { start: zacetek, end: konec });
    tok.on("close", () => {
      const kB = (tok.bytesRead || 0) / 1024;
      odposlano.set(pot, (odposlano.get(pot) || 0) + kB);
    });
    tok.pipe(res);
  });
  return new Promise(res => httpSrv.listen(port, "127.0.0.1", () => res({
    httpSrv,
    vrata: httpSrv.address().port,
    kB: pot => Math.round(odposlano.get(pot) || 0),
    zapri: () => new Promise(r => httpSrv.close(r))
  })));
}

/* LAŽNI YouTube. Player je minimalen, a verzen: onReady dobi predmet z mute() in
   playVideo(), PLAYING pride skozi onStateChange z enakim nizkim številom kot
   pravi API. ZAMIK je edina spremenljivka, ki jo pas nastavlja. */
function laznYouTube(zamik) {
  return `(function () {
  var ZAMIK = ${zamik};
  function Player(el, opts) {
    var self = this;
    this.mute = function () {};
    this.playVideo = function () {};
    this.stopVideo = function () {};
    setTimeout(function () {
      var g = document.getElementById(el);
      if (g) g.innerHTML = '<iframe title="zanka" src="about:blank" allow="autoplay"></iframe>';
      if (opts.events && opts.events.onReady) opts.events.onReady({ target: self });
      setTimeout(function () {
        if (opts.events && opts.events.onStateChange) opts.events.onStateChange({ data: 1 });
      }, ZAMIK);
    }, 400);
  }
  window.YT = { Player: Player, PlayerState: { ENDED: 0, PLAYING: 1, BUFFERING: 3 } };
  if (window.onYouTubeIframeAPIReady) window.onYouTubeIframeAPIReady();
})();`;
}

const SONDA = `(() => {
  const bg = document.getElementById('bg');
  const ytPlast = document.getElementById('bg-yt');
  return {
    razredi: document.body.className,
    zmanjsano: matchMedia('(prefers-reduced-motion: reduce)').matches,
    youtube: { razred: document.body.classList.contains('yt'),
               iframe: !!(ytPlast && ytPlast.querySelector('iframe')),
               prozornostPlasti: ytPlast ? getComputedStyle(ytPlast).opacity : null },
    lokalni: { readyState: bg.readyState, cas: +(bg.currentTime || 0).toFixed(2),
               dolzina: isFinite(bg.duration) ? +bg.duration.toFixed(1) : null,
               prozornost: getComputedStyle(bg).opacity,
               napaka: bg.error ? bg.error.code : null }
  };
})()`;

const CISTI = [];
/* Izjema zunaj promisske verige (npr. v stream handlerju) sicer umori process
   brez finally, brskalniki pa ostanejo viseti in pojedo pomnilnik. */
process.on("uncaughtException", e => {
  console.error("IZJEMA:", e.message);
  for (const f of CISTI) { try { f(); } catch {} }
  process.exit(2);
});

/* Fiksni razpon brskalnikovih vrat se je že sesel na preostalem procesu. Še
   sposoditi si prosto vrata in jih izpustiti je dirka, zato Chrome sam izbere
   vrata (--remote-debugging-port=0) in jih zapiše v DevToolsActivePort. */
async function preberiVrata(profilDir) {
  const datoteka = path.join(profilDir, "DevToolsActivePort");
  for (let i = 0; i < 100; i++) {
    try {
      const prva = fs.readFileSync(datoteka, "utf-8").split("\n")[0].trim();
      if (prva) return Number(prva);
    } catch { /* Chrome datoteko piše šele, ko posluša. */ }
    await wait(200);
  }
  throw new Error("DevToolsActivePort se ni pojavil v " + profilDir);
}

/* zamik == null pomeni: brez laži, pravi YouTube, a blokan (pot onerror).
   zamik == -1 pomeni: lažni API se naloži, nikoli pa ne javi PLAYING. */
async function odprtiPas(zamik, emulirajMirno) {
  const profilDir = path.join(process.env.TEMP, `cdp-ozadje-${Date.now()}`);
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--mute-audio", "--force-device-scale-factor=1", "--window-size=1440,900",
    "--remote-debugging-port=0",
    `--user-data-dir=${profilDir}`, "--no-first-run", "about:blank"],
    { stdio: "ignore" });
  CISTI.push(() => {
    try { spawnSync("taskkill", ["/T", "/F", "/PID", String(chrome.pid)], { stdio: "ignore" }); }
    catch { chrome.kill(); }
  });
  const vrata = await preberiVrata(profilDir);
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
    const t = setTimeout(() => { odzivi.delete(id); rej(new Error("prekoračen rok: " + metoda)); }, 60000);
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
      if (o.method === "Fetch.requestPaused") {
        const url = (o.params.request && o.params.request.url) || "";
        if (zamik !== null && /iframe_api/.test(url)) {
          /* -1: API pride, a PLAYING nikoli — skrajni primer "visi v prazno". */
          const js = zamik >= 0 ? laznYouTube(zamik) : "window.YT={Player:function(){var s=this;this.mute=function(){};this.playVideo=function(){};},PlayerState:{PLAYING:1}};window.onYouTubeIframeAPIReady&&window.onYouTubeIframeAPIReady();";
          send("Fetch.fulfillRequest", { requestId: o.params.requestId, responseCode: 200,
            responseHeaders: [{ name: "Content-Type", value: "text/javascript; charset=utf-8" }],
            body: Buffer.from(js, "utf-8").toString("base64") }, o.sessionId).catch(() => {});
        } else {
          send("Fetch.failRequest", { requestId: o.params.requestId,
            errorReason: "BlockedByClient" }, o.sessionId).catch(() => {});
        }
      }
    }
  });

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: sid } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sid);
  await send("Runtime.enable", {}, sid);
  if (zamik !== null) {
    /* Lažni API živi na istem URL-ju kot pravi, zato mora biti vsak youtube
       zahtevek ujet; sicer bi mix resničnega in lažnega povedal oboje in nič. */
    await send("Fetch.enable", { patterns: [
      { urlPattern: "*youtube*" }, { urlPattern: "*ytimg*" }, { urlPattern: "*googlevideo*" }
    ] }, sid);
  } else {
    await send("Fetch.enable", { patterns: [
      { urlPattern: "*://*.youtube.com/*" }, { urlPattern: "*://*.youtube-nocookie.com/*" },
      { urlPattern: "*://*.ytimg.com/*" }, { urlPattern: "*://*.googlevideo.com/*" }
    ] }, sid);
  }
  await send("Emulation.setDeviceMetricsOverride",
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sid);
  /* Zastavica --force-prefers-reduced-motion v headless Chromeu ne učinkuje;
     emulacija tarce je edini nacin, da se res meri pot mirnega obiskovalca. */
  if (emulirajMirno) await send("Emulation.setEmulatedMedia", { features: [
    { name: "prefers-reduced-motion", value: "reduce" }
  ] }, sid);
  return { send, dog, sid, targetId };
}

async function izmeri(ime, mapa, zamik, cakajMS, emulirajMirno = false) {
  /* Vrata kar jih da OS: fiksna številka je drugič že ustavila meritev, ker je
       bila zasedena, kar ni nič skupnega s hero ozadjem. */
  const srv = await streznik(mapa, 0);
  const { send, dog, sid, targetId } = await odprtiPas(zamik, emulirajMirno);
  const t0 = Date.now();
  await send("Page.navigate", { url: `http://127.0.0.1:${srv.vrata}/index.html` }, sid);
  while (Date.now() < t0 + 25000 && !(dog.get(sid + "|Page.loadEventFired") > 0)) await wait(200);
  await wait(cakajMS);
  const vsi = [];
  for (let i = 0; i < 3; i++) {
    const r = await send("Runtime.evaluate", { expression: SONDA, returnByValue: true }, sid);
    if (!r.result || !r.result.value) throw new Error(`${ime}: sonda ni vrnila ničesar`);
    vsi.push(r.result.value);
    if (i < 2) await wait(900);
  }
  await send("Target.closeTarget", { targetId }, sid).catch(() => {});
  await wait(700);
  const kB = srv.kB("/assets/kolpa-ozadje.mp4");
  await srv.zapri();
  const z = vsi[vsi.length - 1];
  const rezultat = {
    ime, kB,
    youtube: vsi.some(v => v.youtube.razred),
    seZavrtel: vsi.some(v => v.lokalni.cas > 0.2),
    zmanjsano: z.zmanjsano === true,
    prozornost: z.lokalni.prozornost
  };
  console.log(`\n=== ${ime} ===`);
  console.log(`  razred body:     ${z.razredi}`);
  console.log(`  YouTube:         razred=${rezultat.youtube} iframe=${z.youtube.iframe} prozornost plasti=${z.youtube.prozornostPlasti}`);
  console.log(`  lokalni mp4:     pripravljenost=${z.lokalni.readyState} cas=${z.lokalni.cas}s dolzina=${z.lokalni.dolzina}s napaka=${z.lokalni.napaka}`);
  console.log(`  .bg prozornost:  ${rezultat.prozornost}   manjsaj-gibanje: ${rezultat.zmanjsano}`);
  console.log(`  strežnik oddal:  ${kB} KB za assets/kolpa-ozadje.mp4`);
  return rezultat;
}

(async () => {
  const bazi = await izmeri("BAZA (star code), YouTube hitro steče", BAZ, 800, 6000);
  const hitro = await izmeri("POPRAVLJENO, YouTube hitro steče", DOM, 800, 6000);
  const pozno = await izmeri("POPRAVLJENO, YouTube steče tik pred rokom", DOM, 7000, 12000);
  const nikoli = await izmeri("POPRAVLJENO, YouTube nikoli ne javi giba", DOM, -1, 13000);
  const blokirano = await izmeri("POPRAVLJENO, pravi YouTube blokiran", DOM, null, 11000);
  const mirno = await izmeri("POPRAVLJENO, zahtevano manj gibanja", DOM, 800, 6000, true);

  console.log("\n--- presoja ---");
  const napake = [];
  if (bazi.kB < 900)
    napake.push(`Bazni pas ni oddal celotnega posnetka (${bazi.kB} KB), A/B pa trdi, da ga popravlja.`);
  if (!bazi.youtube) napake.push("Bazni pas ni pokazal YouTube plasti, primerjava nima podlage.");

  if (!hitro.youtube) napake.push("Pri popravljeni kodi YouTube plast ni stopila, prihranek pa nima dokaza.");
  if (hitro.kB > 80)
    napake.push(`YouTube deluje, strežnik pa je vseeno oddal ${hitro.kB} KB lokalnega posnetka.`);
  if (bazi.kB - hitro.kB < 500)
    napake.push(`Prihranek ni dokazan: z bazno kodo ${bazi.kB} KB, zdaj ${hitro.kB} KB.`);

  if (!pozno.youtube) napake.push("Pri počasnem YouTubeu plast kljub vsemu ni stopila, pas pa meri napačen obrat.");
  if (pozno.seZavrtel)
    napake.push(`YouTube je stopil pri 7 s, rok pa je kljub zgodnejši zmagi vžgal lokalno zanko (${pozno.kB} KB).`);
  if (pozno.kB > 80)
    napake.push(`Zmaga tik pred rokom je vseeno stala ${pozno.kB} KB; rezerva se je začela prehitro.`);

  if (nikoli.youtube) napake.push("Lažni API je javil PLAYING, pas 'nikoli' pa naj ne bi.");
  if (!nikoli.seZavrtel) napake.push("YouTube nikoli ne javi giba, lokalna zanka pa se NI zavrtela — rezerva je mrtva.");
  if (nikoli.kB < 900) napake.push(`Rezerva se ni naložila do konca (strežnik oddal ${nikoli.kB} KB).`);

  if (blokirano.youtube) napake.push("Blokada ni učinkovala, YouTube je vseeno stezel.");
  if (!blokirano.seZavrtel) napake.push("Pravi YouTube blokiran, lokalna zanka pa se NI zavrtela — pot onerror je mrtva.");
  if (blokirano.kB < 900) napake.push(`Blokirani obiskovalec ni dobil posnetka do konca (${blokirano.kB} KB).`);

  if (!mirno.zmanjsano) napake.push("Zastavica za manj gibanja ni učinkovala, pas pa ni meril ničesar.");
  if (mirno.seZavrtel) napake.push("Obiskovalec je zahteval manj gibanja, lokalna zanka pa se je zavrtela.");
  if (mirno.kB > 80) napake.push(`Mirni obiskovalec je nepotrebno spravil ${mirno.kB} KB posnetka.`);
  if (Number(mirno.prozornost) === 0) napake.push("Mirni obiskovalec nima niti posterja — ozadje je prazno.");

  console.log(`  prihranek: ${bazi.kB} KB -> ${hitro.kB} KB  (pozno: ${pozno.kB} KB, nikoli: ${nikoli.kB} KB, miro: ${mirno.kB} KB)`);
  for (const n of napake) console.log("  NAP: " + n);
  console.log(napake.length ? "NI V REDU" : "V REDU: prihranek dokazan, rezerva živi, rok se prekliče.");
  process.exitCode = napake.length ? 1 : 0;
})().catch(e => { console.error("SMRT:", e.message); process.exitCode = 2; })
  .finally(() => {
    for (const f of CISTI) { try { f(); } catch {} }
    setTimeout(() => process.exit(process.exitCode || 0), 300);
  });
