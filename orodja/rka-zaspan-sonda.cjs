/* ALI OPREMA RES ZASPI OB PREDVAJANJU — IN ALI SE VRNE, KOT MORA?
   Meri lokalno (4198), ker sprememba še ni na produkciji; na javnem naslovju
   bi merili staro CSS. Vsak vzorec se vzame ŠELE, ko se prehod .4 s konča,
   drugače bi merili sredi animacije. Predvajanje je vsakič dokazano z uro
   (#tpCas) in z aria-label gumba ("Ustavi predvajanje"), ne z ugibanjem.

   Dve lekciji iz prvega falsificiranja:
     1) Vrata so bila fiksna (9432), zaporedni teki so si sedli v grlo, Chrome
        se ni zagnal in sonda je umrla — falsifikator je to štel kot "nič ni
        padlo". Zdaj gre vrata v ukazno vrstico, izhod 2 POMENI "niso tekla".
     2) Pavzo sem meril samo s preslednico, tista pa gre skozi tipkovni
        poslušalec, ki opremo razkrije NEZAVISNO od ustavi(). Mutacije, ki je
        ta pot ne more videti, ni odkrita. Zato 07/08 pavzo nareita z NAVADNIM
        MIŠKINIM KLIKOM na gumb — edino pot, kjer se časovnik, zastavljen ob premiku
        miške, res mora iztekati.
     3) Naslov strani je bil vklesan na 4198 — vrata ročnega predogleda, ki jih
        noben skript v repozitoriju ne zagne. Vrata so torej padla, a ne zaradi
        vsebine: brez postrežene strani ni kaj meriti. Zdaj si sonda strežnika
        sama zagne na 4194-4197, kot ga si ostale. */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { zzeni } = require("./rka-streznik.cjs");

const REPO = "C:\\Users\\admin\\Downloads\\sssdf\\rka-onepage";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = Number(process.argv[2] || 9432);
let IZVOR = null;
const SNIJEK = path.join(process.env.TEMP, "rka-oprema-zaspana.png");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CISTI = [];
let napak = 0, vzorcev = 0;

const MERA = `(function(){
  const t = document.querySelector('.transport'), k = document.querySelector('.tipka');
  const ct = getComputedStyle(t), ck = getComputedStyle(k);
  return {
    razred: document.body.classList.contains('oprema-skriti'),
    transport: ct.display + " o=" + (+ct.opacity).toFixed(2),
    tipka: ck.display + " o=" + (+ck.opacity).toFixed(2),
    kazalec: getComputedStyle(document.body).cursor,
    ura: document.getElementById('tpCas').textContent.trim(),
    stanje: document.getElementById('gumbUstavi').getAttribute('aria-label')
  };
})()`;

const vidi = (r) => r.transport.endsWith("o=1.00") && r.tipka.endsWith("o=1.00") && !r.razred;
const svetlo = (r) => r.transport.endsWith("o=1.00") && r.tipka.endsWith("o=1.00");
const skrita = (r) => r.transport.endsWith("o=0.00") && r.tipka.endsWith("o=0.00");

(async () => {
  /* Strežnik najprej in na svojih vratih: brez postrežene strani sonda nima
     kaj meriti, padec pa bi se napačno bral kot napaka vsebine. */
  let s = null;
  for (const p of [4194, 4195, 4196, 4197]) {
    try { s = await zzeni(REPO, p); IZVOR = `http://127.0.0.1:${p}/zgodba.html`; break; }
    catch { }
  }
  if (!s) { console.log("NI TEKLO: prostih ni streznikovih vrat (4194-4197)."); for (const f of CISTI) f(); process.exit(2); }
  CISTI.push(() => { try { s.close(); } catch { } });

  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    "--force-device-scale-factor=1", `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${process.env.TEMP}\\cdp-zasp-${PORT}-${Date.now()}`,
    "--no-first-run", "--window-size=1920,1080", "about:blank"
  ], { stdio: "ignore" });
  CISTI.push(() => { try { chrome.kill(); } catch { } });

  let v = null;
  for (let i = 0; i < 40; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await wait(300); }
  }
  if (!v) { console.log("NI TEKLO: Chrome se ni zagnal na vratih " + PORT); for (const f of CISTI) f(); process.exit(2); }
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

  const napaj = async (url) => {
    await send("Page.navigate", { url }, sid);
    for (let i = 0; i < 60; i++) { if ((await izvedi("document.readyState")) === "complete") break; await wait(300); }
    await wait(2500);
  };
  const potrdi = (ime, ok, r) => {
    vzorcev++;
    console.log((ok ? "  V REDU  " : "  POZOR   ") + ime.padEnd(42) +
      ` transport=${r.transport} tipka=${r.tipka} razred=${r.razred} kazalec=${r.kazalec} ura="${r.ura}" gumb="${r.stanje}"`);
    if (!ok) napak++;
  };
  const premikMiske = (x, y) => send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 }, sid);
  const klikMiske = async (x, y) => {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1, buttons: 1 }, sid);
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1, buttons: 0 }, sid);
  };
  const tipkaProstor = async () => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space" }, sid);
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space" }, sid);
  };

  await napaj(IZVOR);
  console.log("=== živo stanje (1920x1080) na vratih " + PORT);
  const s0 = await izvedi(MERA);
  potrdi("01 pred predvajanjem: vidno", vidi(s0), s0);

  /* Čakanje na spanje je POGOD, ne zamik. V glavi se časovniki zamašijo, ker
     stran ni nujno spredaj, zato je fiksni zamik nad trditvijo 2,5 s pustil
     premalo rezerve: 28. 10. je vzorec 09 padel ob tretjem zaporednem zagonu,
     ne ob prvi. Poll meri tudi, KOLIKO časa je spanje vzelo, in to številko
     izpisuje — zgornja meja ostane trditev, le boljšo mora dokazati. */
  const zaspi = async (meja) => {
    const z = Date.now();
    const rok = z + (meja || 9000);
    for (;;) {
      const r = await izvedi(MERA);
      const porabljeno = Date.now() - z;
      if (skrita(r) || Date.now() > rok) return { r, porabljeno };
      await wait(150);
    }
  };

  await izvedi(`document.getElementById('vBrezZvoka').click()`);
  await wait(1000);
  const s1 = await izvedi(MERA);
  potrdi("02 +1,0 s: še vidno (mirovanje 2,5 s)", vidi(s1) && s1.stanje === "Ustavi predvajanje", s1);

  const z2 = await zaspi();
  potrdi("03 zaspala, a ne prepozno", skrita(z2.r) && z2.porabljeno <= 6000 && z2.r.stanje === "Ustavi predvajanje",
    Object.assign({}, z2.r, { spanje: z2.porabljeno + " ms" }));
  const slika = await send("Page.captureScreenshot", { format: "png" }, sid);
  fs.writeFileSync(SNIJEK, Buffer.from(slika.data, "base64"));

  await premikMiske(900, 500);
  await wait(700);
  const s3 = await izvedi(MERA);
  potrdi("04 po premiku miške: spet vidno", vidi(s3), s3);

  const z4 = await zaspi();
  potrdi("05 po premiku miške ponovno zaspi", skrita(z4.r) && z4.porabljeno <= 6000,
    Object.assign({}, z4.r, { spanje: z4.porabljeno + " ms" }));

  /* Pavza z miško: premik razkrije in armira timer, klik na dejanske
     koordinate gumba ga mora izbrisati. */
  const gumb = await izvedi(`(() => { const b = document.getElementById('gumbUstavi').getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
  await premikMiske(gumb.x, gumb.y - 40);
  await wait(700);
  const s6 = await izvedi(MERA);
  potrdi("06 premik k gumbu: vidno", vidi(s6), s6);
  await klikMiske(gumb.x, gumb.y);
  await wait(700);
  const s7 = await izvedi(MERA);
  potrdi("07 klik na gumb: pavza in vidno", vidi(s7) && s7.stanje === "Nadaljuj predvajanje", s7);

  await wait(3500);
  const s8 = await izvedi(MERA);
  potrdi("08 pavza +3,5 s: ostane vidna (timer izbrisan)", vidi(s8), s8);

  /* Prva luknja, ki jo je najel falsifikator: med pavzo se ob novem premiku
     miške timer ne sme na novo armirati. Brez tega vzorca mutacija "armiraj
     vedno" preživi, ker pavzo merim takoj za klikom, ne pa tudi kasneje. */
  await premikMiske(700, 400);
  await wait(3400);
  const s8b = await izvedi(MERA);
  potrdi("08b pavza + premik: NE sme zaspati", vidi(s8b), s8b);

  /* Skrita vrstica mora pokazati fokus: tipkovnica ne sme odpreti nevidnega. */
  await tipkaProstor();
  const z9 = await zaspi();
  const s9a = z9.r;
  await izvedi(`document.getElementById('gumb60').focus()`);
  await wait(700);
  const s9 = await izvedi(MERA);
  potrdi("09 fokus v transportu: vidno", vidi(s9) && s9a.razred, s9);

  /* Druga luknja: timer med predvajanjem teče naprej, zato mora CSS pravilo
     :focus-within držati vrstico vidno, dokler je fokus v njej — sicer bi
     tipkovnica brskala po nevidnih gumbih. Meriti moram svetlost, ne razreda:
     razred je takrat lahko res pravi, videti pa sme biti samo svetlo. */
  await wait(3400);
  const s9b = await izvedi(MERA);
  potrdi("09b fokus +3,4 s med predvajanjem: svetlo", svetlo(s9b) && s9b.stanje === "Ustavi predvajanje", s9b);

  console.log("=== izvozni način (?render=1) — tu se ne sme zgoditi nič");
  await napaj(IZVOR + "?render=1");
  await izvedi(`(() => { const g = document.getElementById('vBrezZvoka'); if (g) g.click(); })()`);
  await wait(4000);
  const s10 = await izvedi(MERA);
  potrdi("10 render: razred nikoli, opreme ni",
    !s10.razred && s10.transport.startsWith("none") && s10.tipka.startsWith("none"), s10);

  console.log("\nslika zaspale opreme:", SNIJEK, fs.statSync(SNIJEK).size, "B");
  console.log(napak === 0 ? `V REDU: ${vzorcev}/${vzorcev}` : `NAPAK: ${napak}/${vzorcev} vzorcev ni ustrezalo`);
  for (const f of CISTI) f();
  process.exit(napak ? 1 : 0);
})().catch((e) => { console.log("NI TEKLO: " + e.message); for (const f of CISTI) f(); process.exit(2); });
