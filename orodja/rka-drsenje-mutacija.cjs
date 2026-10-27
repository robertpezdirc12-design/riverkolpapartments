/* Sonda rka-drsenje-sonda.cjs trdi pet stvari. Vrata so vredna toliko, kot smo
   jih videli pasti: vsako trditev posebej pokvarimo in zahtevamo, da uiti
   lastna meritev, ne poljubna.

   Okvara se vstreli kot slog v živi dokument, nato pa se pošlje pravi
   'resize' dogodek — stran sama zato zažene prilepi() in se odloči z okvaro v
   strani. Vstrek ob document-start (Page.addScriptToEvaluateOnNewDocument) je
   bil videti preglednejši, a je tiho odpovedal: skripta je tekla, preden je
   obstajal documentElement, zato slog nikoli ni prišel v drevo in je vseh pet
   mutacij ostalo neveljavnih. Meritev, ki ne ve, da ni ničesar vstrelila, ni
   varovalo. Zdaj se prisotnost okvare prebere iz izračunanega sloga.

   SONDA se bere IZ rka-drsenje-sonda.cjs, ne kopira: podvojena meritev se je
   razšla za en znak (b.right - r.right namesto r.right - b.right) in je
   izmislila 17 elementov zunaj, ki jih ni. */
const fs = require("fs");
const { spawn } = require("child_process");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9439;
const wait = ms => new Promise(r => setTimeout(r, ms));
const VIR = __dirname + "\\rka-drsenje-sonda.cjs";
const SONDA = (fs.readFileSync(VIR, "utf8").match(/const SONDA = `([\s\S]*?)`;/) || [])[1];
if (!SONDA) { console.error("SMRT: izraza SONDA v " + VIR + " ni mogoče najti."); process.exit(2); }

/* [ime, trditev, css, dokaz da je okvara vplivala, preizkus ujetja, meritev zaslona]
   Vsaka okvara sme zbuditi SAMO svojo trditev. Tri najdene omejitve instrumenta:
   1. html in body imata overflow:hidden, zato okvari za dokument ne moreta iti
      prek vsebine — podaljšati morata škatlo samega telesa.
   2. Pri mobile:true se layout viewport razširi skupaj s telesom (meritev: okno
      320 → 480), zato širina dokumenta nikoli ne preseže okna; trditev o širini
      je mogoče ujeti le tam, kjer jo meri tudi sonda: namizje, mobile:false.
   3. .stage{overflow:hidden} in .view{overflow:clip} vsebino ostrižeta, zato širok
      notranji element do dokumenta sploh ne pride — to je lastnost strani, ne napaka. */
const MUTACIJE = [
  ["oder bi lahko drsil namesto, da reže", "stagePrec",
    ".domov{padding-block:400px}",
    el => parseFloat(getComputedStyle(el).paddingTop) >= 400,
    o => o.stagePrec > 0],
  ["dokument bi bil višji od okna", "docPrec",
    "html{overflow-y:auto}body{height:1400px!important}",
    () => document.documentElement.scrollHeight > innerHeight + 300,
    o => o.docPrec > 0],
  ["stran bi bila širša od okna", "sirinaPrec",
    "html{overflow-x:auto}body{width:calc(100% + 160px)!important}",
    () => document.documentElement.scrollWidth > innerWidth + 100,
    o => o.sirinaPrec > 0, { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }],
  ["napis bi segel izven odra", "izvenVsi",
    ".domov .enote{transform:translateY(300px)}",
    () => Math.round(document.querySelector('.domov .enote').getBoundingClientRect().bottom) >
         Math.round(document.getElementById('stage').getBoundingClientRect().bottom) + 100,
    o => o.izvenVsi > 0],
  ["v pogledu bi se odprl notranji drsnik", "drsniki",
    ".domov .enote{max-height:120px;overflow-y:auto}",
    () => { const e = document.querySelector('.domov .enote');
      return getComputedStyle(e).overflowY === 'auto' && e.scrollHeight > e.clientHeight; },
    o => o.drsniki > 0]
];

let UBIJ = () => {};
(async () => {
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}\\cdp-dmut-${Date.now()}`,
    "--no-first-run", "--window-size=1500,1000", "about:blank"], { stdio: "ignore" });
  UBIJ = () => { try { chrome.kill(); } catch {} };
  let v; for (let i = 0; i < 40; i++) { try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await wait(400); } }
  if (!v) { chrome.kill(); throw new Error("Chrome se ni zagnal"); }
  const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener("open", r));
  let n = 0; const p = new Map();
  const send = (m, pr = {}, sid) => new Promise((res, rej) => { const id = ++n; p.set(id, { res, rej });
    ws.send(JSON.stringify(sid ? { id, method: m, params: pr, sessionId: sid } : { id, method: m, params: pr })); });
  ws.addEventListener("message", ev => { const m = JSON.parse(ev.data); if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id); m.error ? q.rej(new Error(JSON.stringify(m.error))) : q.res(m.result); } });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const sess = (m, pr = {}) => send(m, pr, sessionId);
  const ev = async ex => { const r = await sess("Runtime.evaluate", { expression: ex, returnByValue: true });
    if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description || r.exceptionDetails)); return r.result.value; };
  await sess("Page.enable"); await sess("Runtime.enable");
  const OSNOVA = { width: 320, height: 640, deviceScaleFactor: 2, mobile: true };
  const postavi = z => sess("Emulation.setDeviceMetricsOverride", z);
  await postavi(OSNOVA);

  const CISTA = o => !(o.stagePrec > 0 || o.docPrec > 0 || o.sirinaPrec > 0 || o.izvenVsi > 0 || o.drsniki > 0);

  const vzemi = async () => {
    await wait(2200);
    const a = JSON.parse(await ev(`JSON.stringify(${SONDA})`));
    await wait(2500);                       /* pisave in slike lahko zrastejo še zdaj */
    const b = JSON.parse(await ev(`JSON.stringify(${SONDA})`));
    if (a.izvenVsi !== b.izvenVsi || a.odmer.g !== b.odmer.g)
      console.log(`   (odločitev se je med meritvijo premaknila: ${JSON.stringify(a.odmer)} → ${JSON.stringify(b.odmer)})`);
    return b;
  };
  /* Naložiti je treba ločeno od branja: med okvaro se ne sme zgoditi nova
     navigacija, ker ta odnese vstrejeni slog in meritev bi bila spet čista. */
  const napotuj = async () => {
    await sess("Page.navigate", { url: "http://127.0.0.1:4183/index.html#domov" });
    /* Navigacija se zavrne šele, ko je dokument zamenjan; vmes je documentElement
       lahko še null in branje classList bi vrnilo izjemo namesto počakanega sloga. */
    for (let i = 0; i < 100; i++) {
      if (await ev("!!document.documentElement && document.documentElement.classList.contains('pripravljen')")) break;
      await wait(120);
    }
  };
  const izmeri = async () => { await napotuj(); return vzemi(); };

  const izhodi = await izmeri();
  console.log(`izhodna točka (brez okvare): ${JSON.stringify(izhodi)}`);
  if (!CISTA(izhodi)) {
    console.log("→ NI V REDU: izhodišče že pade, mutacij se ne da oceniti.");
    ws.close(); chrome.kill(); process.exitCode = 1; return;
  }
  console.log("→ V REDU, lahko ocenjujemo vrata.\n");

  let ujetih = 0;
  for (const [ime, trditev, css, dokaz, preizkus, zaslon] of MUTACIJE) {
    await postavi(zaslon || OSNOVA);
    await napotuj();
    await ev(`(() => { const st = document.createElement('style'); st.id = 'mutacija';
      st.textContent = ${JSON.stringify(css)}; document.head.appendChild(st);
      dispatchEvent(new Event('resize')); })()`);
    await wait(900);                        /* zamik prilepi() je 140 ms, tu še s slikami vred */
    const vpliv = await ev(`(() => { const el = document.querySelector('.domov');
      const f = ${dokaz.toString()}; try { return !!f(el); } catch (e) { return 'napaka: ' + e.message; } })()`);
    const o = await vzemi();
    await ev(`document.getElementById('mutacija')?.remove(); dispatchEvent(new Event('resize'));`);
    await wait(900);
    await postavi(OSNOVA);
    const cistaPotem = await izmeri();
    const nicelna = o.stagePrec === izhodi.stagePrec && o.docPrec === izhodi.docPrec &&
      o.sirinaPrec === izhodi.sirinaPrec && o.izvenVsi === izhodi.izvenVsi && o.drsniki === izhodi.drsniki;
    const ujeto = preizkus(o);
    console.log(`${ujeto && !nicelna ? "UJETA  " : "SPODLETELA"} ${ime}  [${trditev}]`);
    console.log(`   okvara v dokumentu: ${vpliv === true ? "da" : vpliv} · meritev ${JSON.stringify({ stagePrec: o.stagePrec, docPrec: o.docPrec, sirinaPrec: o.sirinaPrec, izvenVsi: o.izvenVsi, drsniki: o.drsniki, g: o.odmer.g, olajsave: o.odmer.olajsave })}`);
    if (vpliv !== true) console.log(`   mutacija je neveljavna: okvara se na strani ne pozna (CSS: ${css})`);
    else if (nicelna) console.log(`   mutacija je neveljavna: sonda ob njej izmeri enako kot brez nje`);
    else if (!ujeto) console.log(`   vrata so gluha: ${trditev} se ni oglasila`);
    if (!CISTA(cistaPotem)) console.log(`   po odstranitvi okvare stran NE ostane čista: ${JSON.stringify(cistaPotem)}`);
    if (ujeto && !nicelna && vpliv === true && CISTA(cistaPotem)) ujetih++;
  }
  const konec = await izmeri();
  console.log(`\n--- presoja ---`);
  console.log(`${ujetih}/${MUTACIJE.length} mutacij ujetih, ${MUTACIJE.length - ujetih} spodletelih`);
  console.log(`obnovljeno stanje: ${CISTA(konec) ? "V REDU" : "NI V REDU " + JSON.stringify(konec)}`);
  console.log(ujetih === MUTACIJE.length && CISTA(konec) ? "V REDU" : "NI V REDU");
  ws.close(); chrome.kill();
  process.exitCode = ujetih === MUTACIJE.length && CISTA(konec) ? 0 : 1;
})().catch(e => { console.error("SMRT:", e.message); UBIJ(); process.exit(2); });
