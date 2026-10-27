/* Meri svetlost ozadja in berljivost besedila čez VEČ TRENUDKOV zanke.
   Sončni blišč po vodi se med predvajanjem premika, zato en kadr ni dokaz.
   Posnetki:
     polno        = stran, kot jo vidi obiskovalec
     t<k>-ozadje  = ista stran brez črk (podlaga pod besedilom v trenutku k)
     golo         = samo vir brez velov (koliko svetlobe je sploh na voljo)
   Računa rka-svetlost.py. Zunanje orodje, ne del strani. */
const { spawn } = require("child_process");
const fs = require("fs");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = "C:\\Users\\admin\\AppData\\Local\\Temp\\rka-shot";
const PORT = 9420 + (Math.floor(Math.random() * 60));
const ZASLONI = {
  namizje: { w: 1440, h: 900, dpr: 1, mobil: false },
  telefon: { w: 390, h: 844, dpr: 3, mobil: true },
  s23u: { w: 338, h: 731, dpr: 3, mobil: true },
  tablica: { w: 768, h: 1024, dpr: 2, mobil: true }
};
const oznaka = process.argv[2] || "pot";
const zaslonI = process.argv[3] || "namizje";
const Z = ZASLONI[zaslonI] || ZASLONI.namizje;
const pogled = process.argv[4] || "domov";
const STARO = process.argv.includes("staro");
/* Zanka je zdaj pravi YouTube vgradni predvajalnik — zamrzniti ga je treba drugače. */
const YT = process.argv.includes("yt");
/* Pogled "mir" namerno nima videa: tam zadošča en sam kader, ne zanka. */
const MIRNO = process.argv.includes("mirno");
const CASI = (process.argv.find(a => /^casi=/.test(a)) || "casi=0.4,2,3.6,5.2,6.8,8.4").slice(5).split(",").map(Number)
  .slice(0, MIRNO ? 1 : 99);
const wait = ms => new Promise(r => setTimeout(r, ms));

const PRAVOKOTNIKI = `(() => {
  const sivi = (s) => { const m = (s||"").match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/);
    return m ? { r:+m[1], g:+m[2], b:+m[3], a: m[4]===undefined ? 1 : +m[4] } : null; };
  /* Pregled VSEGA besedila: ročni seznam selektorjev je vedno premalo obsežen,
     kar je pokazalo svetlejše ozadje. */
  const iz = [];
  for (const el of document.querySelectorAll('.shell *')) {
    if (el.closest('dialog') || el.closest('.skip')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 10 || r.height < 8 || r.bottom < 0 || r.top > innerHeight) continue;
    const s = getComputedStyle(el);
    if (s.visibility !== 'visible' || parseFloat(s.opacity) < 0.05 || s.display === 'none') continue;
    const besedilo = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!besedilo.length) continue;
    const pisava = sivi(s.color); if (!pisava || pisava.a < 0.02) continue;
    const px = parseFloat(s.fontSize), utez = parseInt(s.fontWeight, 10) || 400;
    iz.push({ ozn:(el.className||el.tagName).toString().split(' ')[0].slice(0,14) + ':' +
                   besedilo[0].textContent.trim().replace(/\\s+/g,' ').slice(0,16),
              sel: el.tagName.toLowerCase() + '.' + (el.className||'').toString().split(' ')[0],
              x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height),
              barva:[pisava.r,pisava.g,pisava.b], alfa:pisava.a,
              px:Math.round(px*10)/10, utez, velika: px >= 24 || (px >= 18.66 && utez >= 700) });
    if (iz.length >= 90) break;
  }
  const bgv = document.getElementById('bg');
  return JSON.stringify({
    pravi: iz, zaslona: [innerWidth, innerHeight],
    vir: bgv.videoWidth > 0 ? "video" : "poster",
    videoSirina: bgv.videoWidth, trajanje: Math.round(bgv.duration*10)/10,
    priRazredu: bgv.classList.contains("on"), prosojnost: getComputedStyle(bgv).opacity
  });
})()`;

const SKRIJ_CRKE = `.shell,.shell *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}`;
const STARO_CSS = `
  .bg.on{opacity:.60!important;filter:saturate(.92)!important}
  .veil{background:
    radial-gradient(125% 95% at 74% 6%,rgba(15,42,36,0) 0%,rgba(7,22,15,.52) 58%,rgba(7,22,15,.86) 100%),
    linear-gradient(103deg,rgba(7,22,15,.96) 0%,rgba(7,22,15,.78) 40%,rgba(7,22,15,.30) 72%,rgba(7,22,15,.46) 100%)!important}
  .grain{opacity:.05!important}
  .hero::before{display:none!important}`;

(async () => {
  const mapa = `${process.env.TEMP}\\cdp-svetlost-${Date.now()}`;
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mapa}`, "--no-first-run", "--window-size=1500,1000", "about:blank"],
    { stdio: "ignore" });
  let v; for (let i = 0; i < 40; i++) { try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await wait(400); } }
  if (!v) throw new Error("Chrome se ni zagnal");
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  let n = 0; const p = new Map();
  const send = (m, pr = {}, sid) => new Promise((res, rej) => { const id = ++n; p.set(id, { res, rej });
    ws.send(JSON.stringify(sid ? { id, method: m, params: pr, sessionId: sid } : { id, method: m, params: pr })); });
  ws.addEventListener("message", ev => { const m = JSON.parse(ev.data);
    if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id); m.error ? q.rej(new Error(JSON.stringify(m.error))) : q.res(m.result); } });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const sess = (m, pr = {}) => send(m, pr, sessionId);
  const evalj = async (ex, obljubi = false) => { const r = await sess("Runtime.evaluate", { expression: ex, returnByValue: true, awaitPromise: obljubi });
    if (r.exceptionDetails) throw new Error("JS: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails));
    return r.result.value; };
  await sess("Page.enable"); await sess("Runtime.enable");
  await sess("Emulation.setDeviceMetricsOverride", { width: Z.w, height: Z.h, deviceScaleFactor: Z.dpr, mobile: Z.mobil });
  await sess("Page.navigate", { url: `http://127.0.0.1:4183/index.html#${pogled}` });
  for (let i = 0; i < 60; i++) { if (await evalj("document.documentElement.classList.contains('pripravljen')")) break; await wait(120); }
  for (let i = 0; i < 120; i++) {
    const x = JSON.parse(await evalj(`(() => {const b=document.getElementById('bg');
      return JSON.stringify({on:b.classList.contains('on'),rv:b.readyState,vw:b.videoWidth});})()`));
    if ((MIRNO || x.on) && x.rv >= 2 && x.vw > 0) break;
    await wait(250);
  }
  await wait(1600);
  if (YT) {
    for (let i = 0; i < 80; i++) {
      if (await evalj(`(() => {const s=document.getElementById('bg-yt');return s.classList.contains('nalozen')||s.classList.contains('napaka');})()`)) break;
      await wait(300);
    }
    console.log("  yt plast:", await evalj(`(() => {const s=document.getElementById('bg-yt');
      return JSON.stringify({nalozen:s.classList.contains('nalozen'),napaka:s.classList.contains('napaka'),
        okvir:!!s.querySelector('iframe'),opac:getComputedStyle(s).opacity});})()`));
  }
  if (STARO) { await evalj(`(() => {const s=document.createElement('style');s.textContent=\`${STARO_CSS}\`;document.head.appendChild(s);return 1;})()`); await wait(1000); }

  const meta = JSON.parse(await evalj(PRAVOKOTNIKI));
  fs.writeFileSync(`${process.env.TEMP}\\rka-rects-${oznaka}.json`, JSON.stringify({ ...meta, oznaka, zaslon: zaslonI, pogled, mirno: MIRNO, yt: YT, ...Z }, null, 1));

  const posnemi = async (ime) => {
    const ss = await sess("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(`${OUT}\\s-${oznaka}-${zaslonI}-${ime}.png`, Buffer.from(ss.data, "base64"));
  };
  /* Zanki nikoli ne prepustimo naključja: vsak trenutek zamrznemo in počakamo potrditev. */
  await evalj(`(() => { document.getElementById('bg').pause(); return 1; })()`);
  const dolzina = YT ? 53 : (meta.trajanje || 9);
  /* YouTube predvajalnika ne moremo brati čez originsko mejo, mu pa ukaze
      seekTo + pause preko postMessage. Odzove se šele z alreadyInitialized,
      zato ukaz ponavljamo, dokler ne vrneta se playerState 2 in ciljani čas. */
  const YT_ZAMRZNI = t => `new Promise(r => {
    const f = document.querySelector('.bg-yt iframe');
    if (!f) return r(-1);
    const poslji = (func, args) => f.contentWindow.postMessage(JSON.stringify({event:'command',func,args,id:'merenje',channel:'merenje'}), '*');
    let trajaj = null;
    const rok = setTimeout(() => { clearInterval(ponavljanje); removeEventListener('message', poslus); r(trajaj === null ? -3 : -4); }, 7000);
    function poslus(ev) {
      if (typeof ev.data !== 'string' || ev.data.charAt(0) !== '{') return;
      let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
      const i = d.info || {};
      if (typeof i.duration === 'number' && i.duration > 0) trajaj = i.duration;
      if (i.playerState === 2 && typeof i.currentTime === 'number' && Math.abs(i.currentTime - ${t}) < 0.9) {
        clearTimeout(rok); clearInterval(ponavljanje); removeEventListener('message', poslus); r(i.currentTime);
      }
    }
    const izstrel = () => { poslji('seekTo', [${t}, true]); poslji('pauseVideo', []); };
    f.contentWindow.postMessage(JSON.stringify({event:'listening',id:'merenje',channel:'merenje'}), '*');
    addEventListener('message', poslus);
    izstrel();
    const ponavljanje = setInterval(izstrel, 500);
  })`;
  const casovnik = async (t) => YT
    ? await evalj(YT_ZAMRZNI(t), true)
    : await evalj(`new Promise(r => { const b = document.getElementById('bg');
        if (b.readyState < 2) return r(-1);
        const id = setTimeout(() => r(-2), 4000);
        b.addEventListener('seeked', () => { clearTimeout(id); r(${t}); }, { once: true });
        b.currentTime = ${t}; })`, true);

  await posnemi("polno");
  for (let k = 0; k < CASI.length; k++) {
    const t = Math.min(CASI[k], dolzina - 0.2);
    const dob = await casovnik(t);
    if (dob < 0) { console.log(`  izpuscen trenutek ${t}s (${dob})`); continue; }
    await evalj(`(() => { const s=document.createElement('style'); s.className='skrj'; s.textContent=\`${SKRIJ_CRKE}\`; document.head.appendChild(s); return 1; })()`);
    await wait(220);
    await posnemi(`t${k}-ozadje`);
    await evalj(`document.querySelectorAll('style.skrj').forEach(s=>s.remove()); 1`);
  }
  await evalj(`(() => { const s=document.createElement('style'); s.textContent='.shell{display:none!important}.veil{display:none!important}.grain{display:none!important}'; document.head.appendChild(s); return 1; })()`);
  await wait(250);
  await posnemi("golo");

  console.log(`[${oznaka}${STARO ? " staro" : ""}] ${meta.vir} ${meta.videoSirina}px trajanje=${meta.trajanje}s opacity=${meta.prosojnost} trenutkov=${CASI.length} pravokotnikov=${meta.pravi.length}`);
  ws.close(); chrome.kill();
})().catch(e => { console.error("NAPAKA:", e.message); process.exit(1); });
