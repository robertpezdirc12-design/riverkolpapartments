/* Ali je prehod res ukinjen, ko bralec zahteva zmanjšano gibanje?
   Navadna sonda vzorči šele po koncu prehoda .4 s, zato "zbledi" in "takoj
   zmanjkalo" zanj sta enaka. Časa tu ni mogoče meriti na uri: v glavi brez
   pravega kadra se prehod začne šele ob kadru, kar smo izmerili (odstranjen
   razred je dajal opacity 0 še pri 120 ms, 1 pa pri 400 ms). Zato se meri
   EFektivno trajanje, ki ga je sestavil bralec — .01 ms bodisi z bodisi brez. */
const { spawn } = require("child_process");
const { zzeni } = require("./rka-streznik.cjs");
const REPO = "C:\\Users\\admin\\Downloads\\sssdf\\rka-onepage";
const PORT = Number(process.argv[2] || 9461);
let IZVOR = null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CISTI = [];
let napak = 0;

const STANJE = `(function(){
  const t = document.querySelector('.transport');
  const ct = getComputedStyle(t);
  return {
    razred: document.body.classList.contains('oprema-skriti'),
    o: +(+ct.opacity).toFixed(3),
    trajanje: ct.transitionDuration,
    rm: matchMedia('(prefers-reduced-motion:reduce)').matches
  };
})()`;

(async () => {
  let s = null;
  for (const p of [4194, 4195, 4196, 4197]) {
    try { s = await zzeni(REPO, p); IZVOR = `http://127.0.0.1:${p}/zgodba.html`; break; }
    catch { }
  }
  if (!s) { console.log("NI TEKLO: prostih ni streznikovih vrat (4194-4197)."); process.exit(2); }
  CISTI.push(() => { try { s.close(); } catch { } });

  const chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
    "--autoplay-policy=no-user-gesture-required", "--force-prefers-reduced-motion",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${process.env.TEMP}\\cdp-rm-${Date.now()}`,
    "--no-first-run", "--window-size=1920,1080", "about:blank"
  ], { stdio: "ignore" });
  CISTI.push(() => { try { chrome.kill(); } catch { } });

  let v = null;
  for (let i = 0; i < 60; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await wait(300); }
  }
  if (!v) { console.log("NI TEKLO: Chrome se ni zagnal"); process.exit(2); }
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
    const r = await send("Runtime.evaluate", { expression: izraz, returnByValue: true }, sid);
    if (r.exceptionDetails) throw new Error("JS: " + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  };
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: sid } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sid); await send("Runtime.enable", {}, sid);
  await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }, sid);

  await send("Page.navigate", { url: IZVOR }, sid);
  for (let i = 0; i < 60; i++) { if ((await izvedi("document.readyState")) === "complete") break; await wait(300); }
  await wait(2500);

  const potr = (ime, ok, r) => {
    console.log((ok ? "  V REDU  " : "  POZOR    ") + ime.padEnd(44) + JSON.stringify(r));
    if (!ok) napak++;
  };

  const z = await izvedi(STANJE);
  potr("01 zmanjšano gibanje je dejansko vklopljeno", z.rm === true, z);

  await izvedi(`document.getElementById('vBrezZvoka').click()`);
  await wait(2800);
  /* Razred dodamo ročno in takoj vzorčimo — brez čakanja na prehod. */
  const s2 = await izvedi(`(() => { document.body.classList.add('oprema-skriti');
    return null; })()`);
  await wait(120);
  const s3 = await izvedi(STANJE);
  /* To NI več časovna trditev. V glavi se prehod začne šele ob kadru, zato
     120 ms po razredu ne vemo, koliko prehoda je res preteklo — ista meritev je
     dala 0 pri .01 ms in 0.159 pri .4 s, a lahko da tudi 0 pri .4 s, če je
     razred tam že prej. Zato vzorec napove samo STANJE; trenutek meri 03. */
  potr("02 med predvajanjem je oprema skrita (stanje)", s3.razred && s3.o === 0, s3);

  /* Trenutek prehoda se meri na efektivni trajanju, ne na uri: v glavi brez
     pravega kadra se prehod lahko začne šele ob kadru, zato bi vzorčenje časa
     merilo razpored kadrov in ne CSS. Trajanje izračuna bralec sam. */
  const s5 = await izvedi(`(() => {
    const sek = (el) => getComputedStyle(el).transitionDuration.split(",")
      .map((x) => parseFloat(x.trim().endsWith("ms") ? x : String(parseFloat(x) * 1000)));
    return { transport: sek(document.querySelector('.transport')), tipka: sek(document.querySelector('.tipka')) };
  })()`);
  const hitro = (a) => a.every((ms) => ms <= 1);
  const ok5 = hitro(s5.transport) && hitro(s5.tipka);
  console.log((ok5 ? "  V REDU  " : "  POZOR    ") + "03 trajanje prehoda <= 1 ms (brez animacije)".padEnd(44) + JSON.stringify(s5));
  if (!ok5) napak++;

  /* Vrnitev se meri skozi pravi dogodek in ne z ročnim razredom: v glavi brez
     pravega kadra se prehod sploh ne začne, zato bi 120 ms po odstranjenem
     razredu dalo 0 — artifact strojnega izmenjevanja kadrov, ne napaka. Tu se
     počaka do 600 ms, kar je več kot dovolj za .01 ms prehod, a dokazuje le
     "vrne se", ne "takoj". */
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 900, y: 500, buttons: 0 }, sid);
  await wait(600);
  const s4 = await izvedi(STANJE);
  potr("04 po premiku miške med pavzo: spet vidna", !s4.razred && s4.o === 1, s4);

  console.log(napak === 0 ? "\nV REDU: 4/4 (zmanjšano gibanje = brez prehodov)"
                          : `\nNAPAK: ${napak}/4`);
  for (const f of CISTI) f();
  process.exit(napak ? 1 : 0);
})().catch((e) => { console.log("NAPAKA: " + e.message); for (const f of CISTI) f(); process.exit(1); });
