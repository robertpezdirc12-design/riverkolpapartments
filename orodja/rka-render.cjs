/* Izvoznik spota: platno nalozi v bezglavem Chrome pri 1920x1080, ga pomika po
   okvirjih z izris(s) — isto funkcijo uporablja stran, zato je MP4 dokazljivo
   enak spletnemu predvajanju — in slike cevko predaja ffmpegu.

  rka-render.cjs <60|30> [--jezik=sl|en] [--razmerje=16x9|9x16] [--poskusi] [--brez-zvoka]

Zvok se ne generira na novo: vzame se ze izmerjeni mojster iz zvok/. */
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { zzeni } = require("./rka-streznik.cjs");

const SPLAT = "C:\\Users\\admin\\Downloads\\sssdf\\rka-onepage";
const IZVOZ = "C:\\Users\\admin\\Downloads\\sssdf\\rka-reklama";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const FFMPEG = "C:\\Users\\admin\\.qoder\\bin\\ffmpeg.exe";
const PORT = 9411;
/* Razmerje je lastnost izdelka, ne platna: pokoncna razlicica ima svoj suffix v
   imenu, da ne more prepisati odobrenega lezecega izvoda, in svoje mux-kombinacije,
   ker je zanjo namen en sam — navpicni tok na druzbenem omrezju. */
const RAZMERJE = (process.argv.find(a => a.startsWith("--razmerje=")) || "--razmerje=16x9").split("=")[1];
if (RAZMERJE !== "16x9" && RAZMERJE !== "9x16") throw new Error("razmerje mora biti 16x9 ali 9x16");
const POKONCI = RAZMERJE === "9x16";
const SIRINA = POKONCI ? 1080 : 1920, VISINA = POKONCI ? 1920 : 1080, SRICJE = 30;

const rez = process.argv[2];
const POSKUS = process.argv.includes("--poskusi");
const BREZ_ZVOKA = process.argv.includes("--brez-zvoka");
const JEZIK = (process.argv.find(a => a.startsWith("--jezik=")) || "--jezik=sl").split("=")[1];
if (JEZIK !== "sl" && JEZIK !== "en") throw new Error("jezik mora biti sl ali en");
/* Pilot postreze samo del časovnega lista: izvozi se kot _pilot-* in nikoli ne
   prepise pravega izvoda. Zvoka ne muxa — pilot ima svoj mojster iz predogleda. */
const stevilka = ime => Number((process.argv.find(a => a.startsWith(ime + "=")) || "").split("=")[1]);
const PILOT_OD = stevilka("--od"), PILOT_DO = stevilka("--do");
const PILOT = Number.isFinite(PILOT_OD) && Number.isFinite(PILOT_DO) && PILOT_DO > PILOT_OD;
/* JPEG-zajem je precej lazji od PNG-ja; kakovost 95 je ob crf 17 se nevidna razlika. */
const JPEG = process.argv.includes("--jpeg");
if (rez !== "60" && rez !== "30") throw new Error("raba: rka-render.cjs <60|30> [--poskusi]");
const wait = ms => new Promise(r => setTimeout(r, ms));
/* Vsak zagon pusti za seboj streznik, Chrome in spletno zvezo. Ce jih ugasne
   samo uspesna pot, vsak poraz pusti devet procesov in zaklenjen profil. */
const CISTI = [];

(async () => {
  fs.mkdirSync(IZVOZ, { recursive: true });
  /* Imenik Chrome profila mora biti vsakič svoj. Brisanje ob izhodu včasih
     pade na EPERM, ker taskkill ročaje sprosti šele po vrnitvi; če bi naslednji
     zagon isti zaklenjen imenik brisal pred zagonom, bi nezajeta napaka
     ustavila celoten render. Stare imenike pobere že sam zagon. */
  const KOREN_PROFIL = `${process.env.TEMP}\\cdp-render`;
  try { fs.rmSync(KOREN_PROFIL, { recursive: true, force: true }); } catch { }
  let pobrano = 0;
  for (const ime of fs.readdirSync(process.env.TEMP)) {
    if (!ime.startsWith("cdp-render-")) continue;
    const pot = `${process.env.TEMP}\\${ime}`;
    try {
      if (Date.now() - fs.statSync(pot).mtimeMs > 20 * 60 * 1000) { fs.rmSync(pot, { recursive: true, force: true }); pobrano++; }
    } catch { /* imenik je še v rabi — pobere ga naslednji zagon */ }
  }
  const PROFIL = `${KOREN_PROFIL}-${process.pid}-${Date.now()}`;
  CISTI.push(() => {
    for (let i = 0; i < 3; i++) {
      try { fs.rmSync(PROFIL, { recursive: true, force: true }); return; }
      catch { /* Chrome še drži ročaje: počakaj in poskusi znova */ }
      const kon = Date.now() + 700; while (Date.now() < kon) { }
    }
  });
  console.log(`[faz] profil ${PROFIL.split("\\").pop()}, pobranih starih: ${pobrano}`);

  /* Izvoznik ima svoj strežnik: predogled na 4183 postreza Python, ki ne zna
     Range zahtev, kar pri <video>/<audio> zadrži nalaganje. */
  let streznik = null, vrata = 0;
  for (const p of [4190, 4191, 4192, 4193]) {
    try { streznik = await zzeni(SPLAT, p); vrata = p; break; }
    catch { /* vrata so zasedena, poskusi naprej */ }
  }
  if (!streznik) throw new Error("prostih ni streznikovih vrat (4190-4193)");
  CISTI.push(() => streznik.close());
  console.log(`[faz] streznik na ${vrata} (range podprt)`);

  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
    "--force-device-scale-factor=1", "--font-render-hinting=none",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFIL}`,
    "--no-first-run", `--window-size=${SIRINA},${VISINA}`, "about:blank"
  ], { stdio: "ignore" });
  /* chrome.kill() umori samo starša: devet podojitev preživi in zapre profil.
     Drevo se moram izklopiti po PID-u, drugače vsak poraz onesposobi naslednji
     poskus z EPERM na brisanju. */
  CISTI.push(() => {
    try { spawnSync("taskkill", ["/T", "/F", "/PID", String(chrome.pid)], { stdio: "ignore" }); }
    catch { chrome.kill(); }
  });

  let v;
  for (let i = 0; i < 60; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await wait(300); }
  }
  if (!v) { chrome.kill(); throw new Error("Chrome se ni zagnal na portu " + PORT); }

  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  CISTI.push(() => { try { ws.close(); } catch { /* ze zaprta */ } });
  let id = 0; const obeti = new Map();
  ws.addEventListener("message", e => {
    const m = JSON.parse(e.data);
    if (m.id && obeti.has(m.id)) {
      const { res, rej } = obeti.get(m.id); obeti.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const n = ++id; obeti.set(n, { res, rej });
    ws.send(JSON.stringify(sessionId ? { id: n, method, params, sessionId } : { id: n, method, params }));
  });
  const izvedi = async (izraz, cakaj = false) => {
    const r = await Promise.race([
      send("Runtime.evaluate", { expression: izraz, returnByValue: true, awaitPromise: cakaj }, sid),
      new Promise((_, rej) => setTimeout(() => rej(new Error("Runtime.evaluate tecel > 25 s")), 25000))
    ]);
    if (r.exceptionDetails) throw new Error("JS: " + JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  console.log("[faz] chrome zagnan na portu " + PORT);
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: sid } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sid);
  await send("Runtime.enable", {}, sid);
  /* Napaka v zagnanem zagonu (zazeni je async) do nikomerje izvedji ne pride:
       ujeti jo mora kot dogodek, sicer izvoznik pade na posledici, ne na
       vzroku. Seznam poskrbi, da se izpiše natanko enkrat. */
  const izjeme = new Set();
  ws.addEventListener("message", e => {
    const m = JSON.parse(e.data);
    if (m.method === "Runtime.exceptionThrown" && !izjeme.has(e.data)) {
      izjeme.add(e.data);
      const d = m.params && m.params.exceptionDetails;
      console.log("[izjema] " + ((d && d.exception && d.exception.description) ||
                                 (d && d.text) || "neznana"));
    }
  });
  await send("Emulation.setDeviceMetricsOverride",
    { width: SIRINA, height: VISINA, deviceScaleFactor: 1, mobile: false }, sid);

  console.log("[faz] cdp seja odprta");
  await send("Page.navigate", { url: `http://127.0.0.1:${vrata}/zgodba.html?render=1${POKONCI ? "&razmerje=9x16" : ""}` }, sid);
  console.log("[faz] navigacija poslana");
  /* Ne čakaj na Page.loadEventFired: medijski viri ga lahko zadržijo za nedoločen
     čas. Zaporedna preverba readyState je tista, ki dejansko pove kaj je na zaslonu. */
  let pripravljen = false;
  for (let i = 0; i < 40; i++) {
    if ((await izvedi(`document.readyState`)) === "complete") { pripravljen = true; break; }
    await wait(500);
  }
  if (!pripravljen) throw new Error("stran se ni naložila (readyState = " + await izvedi(`document.readyState`) + ")");
  console.log("[faz] readyState: complete");
  await wait(1500);

  /* Render moda ne potrebuje zvoka; ura je virtualna. Gate se zapre z gumbom
     "brez zvoka", da avdiotrack sploh ne poskusa prevzeti urnika. */
  await izvedi(`(() => { const g=document.getElementById('vBrezZvoka'); if(!g) throw new Error('gated ni na voljo'); g.click(); return 1; })()`);
  console.log("[faz] gate zaprt (brez zvoka)");
  await wait(1200);
  await izvedi(`nastaviRez(${JSON.stringify(rez)}); 1`);
  await izvedi(`nastaviJezik(${JSON.stringify(JEZIK)}); 1`);
  console.log("[faz] rez :" + rez + ", jezik " + JEZIK);
  await wait(1800);

  const enota = await izvedi(`SPOT.rezi[${JSON.stringify(rez)}].dolzina`);
  const kadri = PILOT ? Math.round((PILOT_DO - PILOT_OD) * SRICJE)
                : POSKUS ? SRICJE * 2 : Math.round(enota * SRICJE);
  /* Poskus se zacne za prvim videoskim kadrom, da meri mirno stanje, ne iskanja. */
  const OKVIR_OD = PILOT ? Math.round(PILOT_OD * SRICJE)
                   : POSKUS ? Math.round(6 * SRICJE) : 0;
  if (PILOT) console.log(`pilot: ${PILOT_OD}\u2013${PILOT_DO} s`);

  /* Vsa platna morajo biti dekodirana, sicer izvozi prazne celice. */
  const pripravljeno = await izvedi(`(async () => {
    ustavi();
    await document.fonts.ready;
    const slike = [...document.querySelectorAll('.kader img')];
    await Promise.all(slike.map(s => s.decode().catch(() => {})));
    const video = [...document.querySelectorAll('.kader video')];
    video.forEach(v => { v.pause(); });
    for (const v of video) if (v.readyState < 2)
      await new Promise(r => { v.addEventListener('loadeddata', r, { once: true }); setTimeout(r, 4000); });
    const videoKader = seznam.find(w => w.kader.vrsta === 'video');
    return { slik: slike.length, dekodiranih: slike.filter(s => s.complete && s.naturalWidth).length,
             kadri: seznam.length, dolzina: SPOT.rezi[stanje.rez].dolzina,
             jezik: stanje.jezik, rez: stanje.rez,
             videoKonec: videoKader ? videoKader.konec : 0,
             trajanjeVidea: video && video[0] ? (video[0].duration || 0) : 0,
             opremaSkrita: getComputedStyle(document.getElementById('transport')).display === 'none',
             razmerje: stanje.razmerje,
             razredPokonci: document.body.classList.contains('pokonci'),
             cas: performance.now() };
  })()`, true);
  console.log("pripravljeno:", JSON.stringify(pripravljeno));
  if (pripravljeno.dolzina !== enota) throw new Error("enota se ni preklopila");
  if (!pripravljeno.opremaSkrita) throw new Error("oprema predvajalnika je se vidna — render bi jo posnel");
  if (pripravljeno.dekodiranih !== pripravljeno.slik) throw new Error("slike niso dekodirane");
  /* Razmerje se ne prepise iz platna: ce param ni prišel do strani, bi izvoznik
     posnel lezeco kompozicijo na visokem okvirju in imenoval jo pokoncno. */
  if (pripravljeno.razmerje !== RAZMERJE)
    throw new Error(`stran je v razmerju ${pripravljeno.razmerje}, zahtevano ${RAZMERJE}`);
  if (pripravljeno.razredPokonci !== POKONCI)
    throw new Error("razred body.pokonci se ne ujema z zahtevanim razmerjem");

  /* Video kader je na zaslonu samo do svojega reza; kasneje ga prekrije neprozoren
     sloj, zato ga ni treba vec iskati — iskanje je najpocasnejsi korak izvoza. */
  const iskatiDo = Math.min(enota, pripravljeno.videoKonec + 1 / SRICJE);
  const trajanjeVidea = pripravljeno.trajanjeVidea > 0 ? pripravljeno.trajanjeVidea : 0;
  console.log(`video vir: ${trajanjeVidea.toFixed(2)} s, iskanih do ${iskatiDo.toFixed(2)} s`);

  /* Poskusni zagon nikoli ne prepise pravega izvoda. */
  const izvod = path.join(IZVOZ, (POSKUS ? "_poskus-" : PILOT ? "_pilot-" : "_video-") + rez + "-" + JEZIK +
                          (POKONCI ? "-pokonci" : "") + (JPEG ? "-jpg" : "") + ".mp4");
  const ffmpeg = spawn(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-f", "image2pipe", "-framerate", String(SRICJE), "-vcodec", JPEG ? "mjpeg" : "png", "-i", "pipe:0",
    /* JPEG-slike pridejo iz dekoderja kot yuvj420p v polnem razponu. Brez
       out_range=tv se to ohrani v izvoženki (pc), kar TV narobe razume — stara,
       odobrena pot prek PNG je dala yuv420p(tv). format=yuv420p utrdi oznako. */
    "-vf", "scale=out_range=tv:out_color_matrix=bt709,format=yuv420p",
    "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
    /* Sami ffmpeg-zastavice zapišejo samo matrico; primaries in transfer morata
       v VUI prek x264-params, sicer predvajalnik barve ugiba. */
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    "-x264-params", "colorprim=bt709:transfer=bt709:colourspace=bt709",
    "-movflags", "+faststart", izvod
  ], { stdio: ["pipe", "ignore", "pipe"] });

  let napakaFF = "";
  ffmpeg.stderr.on("data", d => { napakaFF += d.toString(); });
  const izhodFF = new Promise(r => ffmpeg.on("close", r));

  const zapis = buf => new Promise(res => {
    if (ffmpeg.stdin.write(buf)) return res();
    ffmpeg.stdin.once("drain", res);
  });

  const zacetek = Date.now();
  for (let f = 0; f < kadri; f++) {
    const s = (OKVIR_OD + f) / SRICJE;
    await izvedi(`(async () => {
      izris(${s.toFixed(5)});
      ${trajanjeVidea && s <= iskatiDo ? `
      const v = document.querySelector('.kader video');
      if (v && v.duration > 0) {
        const z = ${s.toFixed(5)} % v.duration;
        if (Math.abs(v.currentTime - z) > 0.004) {
          v.pause();
          await new Promise(r => {
            const h = () => { v.removeEventListener('seeked', h); r(); };
            v.addEventListener('seeked', h); setTimeout(r, 900); v.currentTime = z;
          });
        }
      }` : ""}
      return 1;
    })()`, true);

    const { data } = await send("Page.captureScreenshot",
      JPEG
        ? { format: "jpeg", quality: 95, clip: { x: 0, y: 0, width: SIRINA, height: VISINA, scale: 1 } }
        : { format: "png", clip: { x: 0, y: 0, width: SIRINA, height: VISINA, scale: 1 } }, sid);
    await zapis(Buffer.from(data, "base64"));

    if ((f + 1) % (POSKUS ? 15 : 150) === 0) {
      const porabljen = (Date.now() - zacetek) / 1000;
      console.log(`  kader ${f + 1}/${kadri}  (${s.toFixed(2)} s)  ${porabljen.toFixed(0)} s, ` +
        `ostane ~${Math.round(porabljen / (f + 1) * (kadri - f - 1))} s`);
    }
  }
  ffmpeg.stdin.end();
  const kodaFF = await izhodFF;
  if (kodaFF !== 0) throw new Error("ffmpeg izhod " + kodaFF + "\n" + napakaFF.slice(-1200));
  console.log(`video gotov: ${path.basename(izvod)} v ${((Date.now() - zacetek) / 1000).toFixed(0)} s`);

  /* Cisti seznam jih ugasne v obratnem vrstnem redu: drevo Chrome, nato
     spletna zveza, nato streznik. Rokicno ugašanje tukaj bi pustilo eno pot. */
  /* Poskusna slika traja dve sekundi: mux nad produktom bi jo zapisal kot
     konen 60-sekundni rez. Poskus sme ostati v _poskus-* in nikoli ne sega
     v rka-*.mp4. */
  if (BREZ_ZVOKA || PILOT || POSKUS) return;

  /* Mux: video + ze izmerjeni mojster. Ni novega normaliziranja. */
  /* Slika je zapisana v enem jeziku, zato se tudi muxa samo z njim: angleški
     zvok nad slovenskimi napisi bi bil napačen izdelek, ne različica.
     Seznam je ista kot v rka-mux.py in jo preverja rka-izvoz-preveri.py — če
     bi razslo, bi ponovni izvoz tiho izpustil družbeni rez in vrata bi to
     spregledala, ker pregledane datoteke ne bi bilo. */
  /* Pokoncna razlicica ima en namen: navpicni tok. Mojster in splet ostaneta
     lezeca, ker ju je na tistem platnu odobril Robert — dvojiti isti zvok pod
     drugim slikovnim izrazom bi bil nov izdelek, ne kopija. */
  const kombinacije = POKONCI
    ? [[JEZIK, "druzbeno"]]
    : JEZIK === "sl"
      ? [["sl", "mojster"], ["sl", "splet"], ["sl", "druzbeno"]]
      : [["en", "splet"], ["en", "druzbeno"]];
  const oznaka = POKONCI ? "-pokonci" : "";
  for (const [jezik, cilj] of kombinacije) {
    const zvokPot = path.join(SPLAT, "zvok", `master-${rez}-${jezik}-${cilj}.m4a`);
    const izhodPot = path.join(IZVOZ, `rka-${rez}-${jezik}-${cilj}${oznaka}.mp4`);
    if (!fs.existsSync(zvokPot)) throw new Error(`manjka izmerjeni mojster ${path.basename(zvokPot)} — mux se ne začne`);
    const koda = await nova((res => {
      const p = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        "-i", izvod, "-i", zvokPot, "-map", "0:v:0", "-map", "1:a:0",
        "-c", "copy", "-shortest", "-movflags", "+faststart", izhodPot], { stdio: "ignore" });
      p.on("close", res);
    }));
    if (koda !== 0) throw new Error("mux ni uspel za " + izhodPot);
    console.log(`  + ${path.basename(izhodPot)}  ${(fs.statSync(izhodPot).size / 1048576).toFixed(1)} MB`);
  }
  console.log("\nizvozeno v " + IZVOZ);
})().catch(e => {
  console.error("NAPAKA: " + e.message);
  process.exitCode = 1;
}).finally(() => {
  for (const f of CISTI.reverse()) { try { f(); } catch { /* ze ugasnjen */ } }
  /* Poraz ne sme pustiti processa, ki bi cpal za seboj: vzrok je ze izpisian. */
  if (process.exitCode) process.exit(process.exitCode);
});

function nova(f) { return new Promise(r => f(r)); }
