/* KAJ SE ZGODI Z OPREMO MED PREDVAJANJEM?
   Meri na JAVNI naslovju (ne lokalno), ker se UX sodi na produkciji.

   Prva verzija te sonde je vrnila ura=null, t=null, predvaja=false — ugibal sem
   imena globalk, ki ne obstajajo, zato trditev "oprema ostane vidna med
   predvajanjem" ni bila dokazana. Sedaj berem samo instrumente, ki jih koda
   zares spreminja: #tpCas (textContent), #trak[aria-valuenow] in
   #gumbUstavi[aria-label], ki ga preoblikujGumb() nastavi na "Ustavi
   predvajanje" samo med predvajanjem. Če se ura premakne, je predvajanje
   dokazano; šele takrat smejo številke za opremo. */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9431;
const URL = "https://robertpezdirc8-prog.github.io/riverkolpapartments/zgodba.html";
const SNIJEK = path.join(process.env.TEMP, "rka-oprema-med-predvajanjem.png");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CISTI = [];

const IZBRISNIKI = {
  transport: ".transport", tipka: ".tipka", klapa: ".klapa",
  varnost: ".varnost", skip: ".skip", napisi: ".napisi"
};

(async () => {
  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    "--force-device-scale-factor=1", `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${process.env.TEMP}\\cdp-oprema-${Date.now()}`,
    "--no-first-run", "--window-size=1920,1080", "about:blank"
  ], { stdio: "ignore" });
  CISTI.push(() => { try { chrome.kill(); } catch { } });

  let v = null;
  for (let i = 0; i < 60; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await wait(300); }
  }
  if (!v) throw new Error("Chrome se ni zagnal");
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  CISTI.push(() => { try { ws.close(); } catch { } });
  let n = 0; const p = new Map();
  const send = (m, pr = {}, sid) => new Promise((res, rej) => {
    const id = ++n; p.set(id, { res, rej });
    ws.send(JSON.stringify(sid ? { id, method: m, params: pr, sessionId: sid } : { id, method: m, params: pr }));
  });
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id);
      m.error ? q.rej(new Error(JSON.stringify(m.error))) : q.res(m.result); }
  });
  const izvedi = async (izraz) => {
    const r = await Promise.race([
      send("Runtime.evaluate", { expression: izraz, returnByValue: true }, sid),
      new Promise((_, rej) => setTimeout(() => rej(new Error("Runtime.evaluate tece > 20 s")), 20000))
    ]);
    if (r.exceptionDetails) throw new Error("JS: " + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  };
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: sid } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sid); await send("Runtime.enable", {}, sid);
  await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }, sid);
  await send("Page.navigate", { url: URL }, sid);
  for (let i = 0; i < 60; i++) { if ((await izvedi("document.readyState")) === "complete") break; await wait(400); }
  await wait(3000);

  const mera = `(function(){
     const S = ${JSON.stringify(IZBRISNIKI)};
     const izpis = {};
     for (const [k, sel] of Object.entries(S)) {
       const e = document.querySelector(sel);
       if (!e) { izpis[k] = "ni elementa"; continue; }
       const r = getComputedStyle(e);
       const bb = e.getBoundingClientRect();
       izpis[k] = r.display + " o=" + (+r.opacity).toFixed(2) + " v=" + r.visibility +
                  " h=" + Math.round(bb.height) + " y=" + Math.round(bb.top);
     }
     const cas = document.getElementById('tpCas');
     const trak = document.getElementById('trak');
     const gumb = document.getElementById('gumbUstavi');
     return {
       izpis,
       ura: cas ? cas.textContent.trim() : "NICE",
       sek: trak ? trak.getAttribute('aria-valuenow') : "NICE",
       stanje: gumb ? gumb.getAttribute('aria-label') : "NICE",
       razred: document.body.className
     };
   })()`;

  const izpisi = (nas, r) => {
    console.log(`--- ${nas}: ura="${r.ura}" sek=${r.sek} gumb="${r.stanje}"`);
    for (const [k, v] of Object.entries(r.izpis)) console.log(`    ${k.padEnd(9)} ${v}`);
  };

  izpisi("miranje", await izvedi(mera));

  /* Klik na "Brez zvoka" ZELENJA predvajanje (zacni(false) → predvajaj()), zato
     tu ne pritiskamo presledka prve sonde: tisti je spot ustavil, preden smo
     koli merili. Sedaj vzorčimo trikrat, medtem ko se ura dokazano pomika. */
  console.log("uvod:", await izvedi(`(() => { const g = document.getElementById('vBrezZvoka');
    return g ? (g.click(), 'kliknjen') : 'uvoda ni (ze mimo)'; })()`));

  let vzorec = null;
  for (let i = 0; i < 8; i++) {
    await wait(600);
    vzorec = await izvedi(mera);
    if (vzorec.stanje === "Ustavi predvajanje") break;
  }
  console.log("stanje po uvodnem kliku:", vzorec.stanje);
  izpisi("+0,5 s", vzorec);

  await wait(2000);
  const drugi = await izvedi(mera);
  izpisi("+2,5 s", drugi);

  await wait(2500);
  const tretji = await izvedi(mera);
  izpisi("+5,0 s", tretji);

  const slika = await send("Page.captureScreenshot", { format: "png" }, sid);
  fs.writeFileSync(SNIJEK, Buffer.from(slika.data, "base64"));
  console.log("slika:", SNIJEK, fs.statSync(SNIJEK).size, "B");

  const uri = [vzorec, drugi, tretji].map(r => r.ura);
  const napreduje = new Set(uri).size === 3;
  console.log("ure zaporedoma:", uri.join(" | "),
    napreduje ? "→ PREDVAJANJE DOKAZANO (ura se pomika, gumb pravi 'Ustavi')"
              : "→ URA SE NE POMIKA: predvajanje ni dokazano, nobena trditev o opremi med predvajanjem ne velja");

  const pas = await izvedi(`(() => {
     let dno = 1080; const vrh = { };
     for (const sel of ['.tipka', '.transport']) { const e = document.querySelector(sel);
       if (!e) continue; const b = e.getBoundingClientRect();
       if (getComputedStyle(e).display !== 'none') vrh[sel] = Math.round(b.top) + '..' + Math.round(b.bottom); }
     return JSON.stringify(vrh); })()`);
  console.log("spodnji pas v zaslonu (1920x1080):", pas);

  for (const f of CISTI) f();
})().catch((e) => { console.log("NAPAKA: " + e.message); for (const f of CISTI) f(); process.exit(1); });
