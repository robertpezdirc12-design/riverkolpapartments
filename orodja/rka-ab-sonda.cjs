/* Sonda A/B strani: functionalne preizkuse (preklop bez prekida sviranja,
   skok na oznako, preklop dolžine) + posnetka zaslona na dveh širinah.
   Meri stanje predmeta, ne domnevo iz kode. */
const { spawn } = require("child_process");
const fs = require("fs");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
// Vsak zagon potrebuje svoja vrata: prejsni Chrome jih sprazni sele nekaj sekund
// po kill(), in fiksno stevilka med zaporednimi zagoni pomeni vrtcno "se ni oglasil".
const PORT = 9400 + (process.pid % 400), wait = ms => new Promise(r => setTimeout(r, ms));
const DOM = "http://127.0.0.1:4188";
const IZHOD = process.env.TEMP + "\\rka-ab";

const napake = [];
let rezultat = [];
function check(ime, dejansko, pricakovano) {
  const ok = String(dejansko) === String(pricakovano);
  rezultat.push(`${ok ? "OK  " : "NAPA"} ${ime}: ${dejansko}${ok ? "" : " (pričakovano " + pricakovano + ")"}`);
  if (!ok) napake.push(ime);
}

(async () => {
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}\\cdp-ab-${Date.now()}`,
    "--no-first-run", "--autoplay-policy=no-user-gesture-required",
    "--window-size=1500,1000", "about:blank"], { stdio: "ignore" });
  let v;
  for (let i = 0; i < 60; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await wait(300); }
  }
  if (!v) throw new Error("Chrome se ni oglasil na CDP vratih");
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  let n = 0; const p = new Map();
  const send = (m, pr = {}, sid) => new Promise((res, rej) => {
    const id = ++n; p.set(id, { res, rej });
    ws.send(JSON.stringify(sid ? { id, method: m, params: pr, sessionId: sid }
                              : { id, method: m, params: pr }));
  });
  ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id);
      m.error ? q.rej(new Error(JSON.stringify(m.error))) : q.res(m.result); }
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
      napake.push("konzola: " + (m.params.args[0]?.value || ""));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error")
      napake.push("log: " + m.params.entry.text + " @ " + (m.params.entry.url || "?"));
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const sess = (m, pr = {}) => send(m, pr, sessionId);
  const ev = async ex => {
    const r = await sess("Runtime.evaluate", { expression: ex, returnByValue: true,
                                               awaitPromise: true });
    // Izjema na strani NI konec sonde: vrednost postane IZJEMA, preizkus tako
    // pade kot navaden razlicen rezultat. Zrusena sonda ne sme nikoli izgledati
    // kot opravljen pregled.
    if (r.exceptionDetails) {
      const opis = String(r.exceptionDetails.exception?.description
        || r.exceptionDetails.text || "napaka izvajanja").split("\n")[0];
      napake.push("izjema na strani: " + opis);
      return "IZJEMA";
    }
    return r.result.value;
  };
  await sess("Page.enable"); await sess("Runtime.enable"); await sess("Log.enable");
  await sess("Emulation.setDeviceMetricsOverride",
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await sess("Page.navigate", { url: DOM + "/" });
  await wait(2500);
  await ev(`document.fonts.ready.then(() => "gotovo")`);

  check("kodek m4a v brskalniku",
    await ev(`document.getElementById('zvok').canPlayType('audio/mp4; codecs="mp4a.40.2"')`),
    "probably");
  check("vrst v tabeli (:60)", await ev(`document.querySelectorAll("#telo tr").length`), 22);
  check("znakov na uri", await ev(`document.querySelectorAll("#ura b").length`), 22);
  check("mer na uri", await ev(`document.querySelectorAll("#ura .merka").length`), 7);
  check("zacetni vir", await ev(`document.getElementById("zvok").getAttribute("src")`),
    "B-60-sl.m4a");
  // Izmisljeni oznaki (<tabela>, <glavni>) sta stozili razclenjevalnik: brez
  // pravega <table> browser vrze vse <tr> stran in tabela ostane prazna.
  check("glavni elementi so pravi", await ev(
    `["main","table.tabela","footer.opombe"].filter(s=>document.querySelector(s)).length`), 3);
  check("oznaka pod pripovedjo", await ev(
    `document.querySelector("#telo tr td:nth-child(3)").textContent`), "kitla · pod pripovedjo");
  check("vrstice so casovno razvrsene", await ev(
    `[...document.querySelectorAll("#telo tr")].every((t,i,a)=>!i||+a[i-1].dataset.t<=+t.dataset.t)`),
    "true");

  // 1) preklop A: mora zamenjati vir in oznako, brez ponovnega naloževanja časa
  await ev(`document.getElementById("ga").click(); "ok"`);
  await wait(700);
  check("vir po preklopu na A", await ev(`document.getElementById("zvok").getAttribute("src")`),
    "A-60-sl.m4a");
  check("gumb A označen", await ev(`document.getElementById("ga").getAttribute("aria-pressed")`),
    "true");
  check("dolzina A masterja (s)",
    Math.round(await ev(`document.getElementById("zvok").duration`)), 60);

  // 2) skok na vrstico: currentTime = t − 1 s. Brano je takoj v istem izreku,
  //    sicer presekamo vrednost sredi predvajanja in merimo zamik, ne skok.
  check("polozaj ob skoku na 30,00 s", await ev(
    `(() => { const tr = [...document.querySelectorAll("#telo tr")]
                  .find(t => t.dataset.t === "30.000");
       tr.click(); return document.getElementById("zvok").currentTime.toFixed(2); })()`),
    "29.00");
  await wait(600);
  check("predvajanje tece po skoku",
    await ev(`!document.getElementById("zvok").paused && !document.getElementById("zvok").ended`),
    "true");

  // 2b) skok z znaka na uri: tudi ura je klicna, ne samo tabela
  check("polozaj ob skoku z znaka na 43,13 s", await ev(
    `(() => { document.querySelector('#ura b[data-t="43.125"]').click();
       return document.getElementById("zvok").currentTime.toFixed(2); })()`),
    "42.13");
  await wait(600);

  // 3) tipkovnica: x vrne na B, desno puščica +1 s
  await ev(`window.dispatchEvent(new KeyboardEvent("keydown",{key:"x"})); "ok"`);
  await wait(500);
  check("preklop z x", await ev(`document.getElementById("zvok").getAttribute("src")`),
    "B-60-sl.m4a");
  const pred = await ev(`document.getElementById("zvok").currentTime`);
  await ev(`document.getElementById("zvok").pause(); "ok"`);
  await wait(250);
  await ev(`window.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight"})); "ok"`);
  await wait(300);
  check("desna puscica premakne natanko za 1 s",
    (await ev(`document.getElementById("zvok").currentTime`) - pred).toFixed(2), "1.00");

  // 4) preklop dolžine
  await ev(`document.querySelector(".rez[data-rez='30']").click(); "ok"`);
  await wait(900);
  check("vrst po preklopu na :30", await ev(`document.querySelectorAll("#telo tr").length`), 10);
  check("vir po preklopu dolzine", await ev(`document.getElementById("zvok").getAttribute("src")`),
    "B-30-sl.m4a");
  check("nalozen posnetek je res 30 s",
    Math.round(await ev(`document.getElementById("zvok").duration`)), 30);
  check("oznaka ostane na B", await ev(`document.getElementById("gb").getAttribute("aria-pressed")`),
    "true");

  // 5) odsoten JS: tabela mora ostati berljiva (22 vrst iz Pythona)
  await sess("Emulation.setScriptExecutionDisabled", { value: true });
  await sess("Page.navigate", { url: DOM + "/" });
  await wait(900);
  check("vrst brez JavaScripta", await ev(`document.querySelectorAll("#telo tr").length`), 22);
  await sess("Emulation.setScriptExecutionDisabled", { value: false });

  // posnetka zaslona
  for (const s of [{ w: 1440, h: 900, dpr: 1, mob: false, ime: "ab-1440" },
                   { w: 390, h: 844, dpr: 2, mob: true, ime: "ab-390" }]) {
    await sess("Emulation.setDeviceMetricsOverride",
      { width: s.w, height: s.h, deviceScaleFactor: s.dpr, mobile: s.mob });
    await sess("Page.navigate", { url: DOM + "/" });
    await wait(2200);
    await ev(`document.fonts.ready.then(() => "gotovo")`);
    const { data } = await sess("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(`${IZHOD}\\${s.ime}.png`, Buffer.from(data, "base64"));
    const mer = await ev(`(() => { const t = document.querySelector("table"),
      u = document.getElementById("ura"), v = getComputedStyle(document.body);
      return JSON.stringify({ vrhUre: Math.round(u.getBoundingClientRect().top),
        sirinaTabele: Math.round(t.getBoundingClientRect().width),
        znakiNaUri: document.querySelectorAll("#ura b").length,
        visinaStrani: document.documentElement.scrollHeight, visinaVida: innerHeight,
        premocDrsi: document.documentElement.scrollWidth > innerWidth,
        ozadje: v.backgroundColor }); })()`);
    console.log(`  ${s.ime}: ${mer}`);
  }

  console.log(rezultat.join("\n"));
  console.log(napake.length ? "NAPAKE:\n" + napake.join("\n") : "brez konzolnih napak");
  // zakljucna oznaka: voznik mutacij jo zahteva, sicer bi zrusena sonda
  // ostala brez izpisa in se stevala kot "nic ni padlo"
  console.log(`KONEC ${rezultat.filter(l => l.startsWith("OK")).length}/${rezultat.length}`);
  chrome.kill();
  process.exitCode = napake.length ? 1 : 0;
})();
