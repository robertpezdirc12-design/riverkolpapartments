/* Vrata za FILMSKO stran. rka-zgodba-sonda.cjs trdi sedem stvari in ima še tri
   varovalke, ki smejo javiti, da meritev sploh ni bila narejena. Dokler teh
   trditev nismo videli PASTI, so le ugibanje, da merijo, kar naj bi merile. Zato
   se vsaka posebej pokvari in zahteva:
     - da okvara sploh pride v dokument (sicer je mutacija NEVELJAVNA),
     - da se izmerjeno stanje na ISTI meritvi spremeni glede na čisti vzorec,
     - da oglasi RAVNO svojo trditev in nobene druge (sicer meritve ne ločimo),
     - da je stran po okvari spet čista.
   Tiha, neveljavna ali stranska mutacija šteje kot spodletela — enako kot gluha
   vrata.

   Tri žrtve teh vrat so bile njihove lastne trditve in številke:
   1) dokler je sekaPrednik() končal sprehod pri documentElement, je
      body{overflow:hidden} (zgodba.css:31) ostal v verigi in je oprostil PRAVI
      vsak element strani — "zunaj" nikoli ne more biti izpolnjen;
   2) dokler izvoznega okna nihče ni meril, je bila trditev "izvoz ni spremenjen"
      le veroizpoved: živi odzivnostni blok ustreza tudi oknu 1080 x 1920, v
      katerem rka-render.cjs dela pokončne masterje;
   3) cilja 150 px in 103,68 px sva bila izračunana iz CSS aritmetike in oba
      napačna. Pokončnemu napisu vlada body.pokonci .napisi (zgodba.css:347), ne
      --rob-s, ležečemu pa osnovni clamp (zgodba.css:22), ki je bil med tem
      dvignjen. Pravi merita 140 px in 123,11 px; potrdila sta jih slikovna
      primerjava z predanima datotekama (rka-izvoz-okvir.cjs + .py). Mutaciji
      izrob sta zato razporejeni na dejansko ročico vsakega okna.

   SONDA, NAMENOMA, ZASLONI in IZVOZ se berejo IZ rka-zgodba-sonda.cjs, ne
   kopirajo: podvojena meritev se je na index strani razšla za en znak in je
   izmislila 17 elementov zunaj, ki jih ni. Evalana koda je lastna datoteka te
   mize, ne noben zunanji podatek. */
const fs = require("fs");
const { spawn } = require("child_process");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9443;
const wait = ms => new Promise(r => setTimeout(r, ms));
const VIR = __dirname + "\\rka-zgodba-sonda.cjs";
const NASLOV = "http://127.0.0.1:4183/zgodba.html";

const izvor = fs.readFileSync(VIR, "utf8");
const izjava = (izraz, ime) => {
  const m = izvor.match(izraz);
  if (!m) { console.error(`SMRT: v ${VIR} ne najdem izjave "${ime}" — mutacijska vrata ne merijo ničesar.`); process.exit(2); }
  return m[0];
};
/* Končna vrednost evaliranega programa je njegov zadnji izraz, torej četverica.
   Tako dobimo SONDO že razrešeno (s pravimi ustrezi za \s in NAMENOMA). */
const [NAMENOMA, SONDA, ZASLONI, IZVOZ] = eval(
  izjava(/^const NAMENOMA = \[[\s\S]*?\];$/m, "NAMENOMA") + "\n" +
  izjava(/^const SONDA = `[\s\S]*?`;/m, "SONDA") + "\n" +
  izjava(/^const ZASLONI = \[[\s\S]*?\];$/m, "ZASLONI") + "\n" +
  izjava(/^const IZVOZ = \[[\s\S]*?\];$/m, "IZVOZ") +
  "\n[NAMENOMA, SONDA, ZASLONI, IZVOZ];");
if (typeof SONDA !== "string" || !SONDA.startsWith("(() =>")) {
  console.error("SMRT: izraz SONDA je bil izvlečen poškodovan."); process.exit(2);
}
const Z = ime => {
  const z = ZASLONI.find(x => x.ime === ime);
  if (!z) { console.error(`SMRT: zaslon "${ime}" ni v ZASLONI.`); process.exit(2); }
  return { width: z.w, height: z.h, deviceScaleFactor: z.dpr, mobile: z.mobil };
};
const IZRAZ = "JSON.stringify(" + SONDA + ")";

/* Katera trditev se je oglasila. Ločeno po vrsti meritve, da izvozne številke
   ne morejo nakljudno obsoditi živega vzorca in obratno. */
const POZIV = {
  sonda: {
    docPrec: o => o.docPrec > 0,
    sirinaPrec: o => o.sirinaPrec > 0,
    zunaj: o => o.zunaj.length > 0,
    prerez: o => o.prerez.length > 0,
    drsniki: o => o.drsniki.length > 0,
    prekriva: o => o.prekriva.length > 0,
    zadajVrata: o => !!o.zadajVrata && o.zadajVrata.ostalo === 0 && o.zadajVrata.dno > o.zadajVrata.vrh,
    varovalka: o => o.zadajVrata === null
  },
  izvoz: {
    izrob: o => Math.abs(o.odstop - o.cak) > 0.6,
    izvnosno: o => o.vnosno !== "",
    izoprema: o => o.transport !== "none" || o.klapa !== "none"
  }
};
const klici = o => Object.keys(POZIV[o.vrsta]).filter(k => POZIV[o.vrsta][k](o));
const STEUJE = o => o.vrsta === "izvoz"
  ? `napis ${o.odstop} px od dna (zamrznjeno ${o.cak}) · vpeto "${o.vpeto}" · vnosno "${o.vnosno}" · oprema ${o.transport}/${o.klapa}`
  : `zunaj=${o.zunaj.length} prerez=${o.prerez.length} drsniki=${o.drsniki.length} ` +
    `prekriva=${o.prekriva.length} doc+${o.docPrec} sir+${o.sirinaPrec} ` +
    (o.zadajVrata ? `ostalo=${o.zadajVrata.ostalo} dno=${o.zadajVrata.dno}/vrh=${o.zadajVrata.vrh}` : "brez vrat");

/* [ime, trditev, meritev, koda, dokaz okvare, dodatni korak]
   "meritev" je ime zaslona (živa) ali izvoznega okna (izvoz). */
const MUTACIJE = [
  ["dokument bi bil višji od okna", "docPrec", "slog", "namizje",
    "html{overflow-y:auto!important}body{height:1400px!important}",
    () => document.documentElement.scrollHeight > innerHeight + 300, null],

  ["dokument bi bil širši od okna", "sirinaPrec", "slog", "namizje",
    "html{overflow-x:auto!important}body{width:calc(100% + 220px)!important}",
    () => document.documentElement.scrollWidth > innerWidth + 100, null],

  ["v pogledu bi se odprl nepričakovan drsnik", "drsniki", "js", "sirina-320",
    /* Vstreli se mora NEBESEDNI drsnik: če ima besedni element svoje okno z
       overflow, je to hkrati tudi prerez — dve trditvi na eni okvari, kar ne
       more dokazati, da vrata ločujejo. Stran pravega drsnika nima, zato ga
       naredimo mi; ujet je seznam drsnikov, ne besedilo. */
    `document.body.insertAdjacentHTML("beforeend", ` +
    `'<div id="mut-drsnik" style="position:fixed;top:8px;left:8px;width:120px;height:40px;` +
    `overflow-y:auto;z-index:130"><p style="height:300px;margin:0">okvara</p></div>')`,
    /* Dokaz sme gledati SAMO vstrejeni element: telo ima svoje upravičene drsnike
       (#vrata na nizkem oknu), zato "nekje na telesu se vrti" ni dokaz okvare. */
    () => { const e = document.getElementById("mut-drsnik");
      return !!e && e.scrollHeight > e.clientHeight && /auto|scroll/.test(getComputedStyle(e).overflowY); }, null],

  ["gumb na desnem robu bi ušel iz platu", "zunaj", "slog", "sirina-320",
    ".tp-skupina:last-of-type{transform:translateX(120px)}",
    () => document.querySelector(".tp-skupina:last-of-type .tp-bes:last-child")
      .getBoundingClientRect().right > innerWidth + 40, null],

  ["besedilo bi bilo prerezano", "prerez", "slog", "sirina-320",
    ".vr-lede{max-height:16px;overflow:hidden}",
    () => { const e = document.querySelector(".vr-lede");
      return getComputedStyle(e).overflowY === "hidden" && e.scrollHeight > e.clientHeight; }, null],

  ["napis bi sedel čez kontrolno vrstico", "prekriva", "js", "namizje",
    /* V gate stanju .klapa še ni vidna (platno se zavrti šele po zagonu), zato
       okvara ne more biti premik kadra. Vstavimo besedni element, ki sede čez
       kontrole — to je natanko tisto, kar trditev prepoveduje. */
    `window.__pk = document.createElement('p'); __pk.id = 'mut-prekriva';
       __pk.textContent = 'okvara čez kontrole';
       __pk.style.cssText = 'position:fixed;bottom:6px;left:20%;padding:6px;background:#000;color:#fff;z-index:130';
       document.body.appendChild(__pk);`,
    () => { const e = document.getElementById("mut-prekriva"); if (!e) return false;
      const r = e.getBoundingClientRect(), tp = document.getElementById("transport").getBoundingClientRect();
      return r.bottom > tp.top + 1 && r.top < tp.bottom - 1; }, null],

  ["licenčna opomba vrat bi ostala pod kontrolami", "zadajVrata", "slog", "sirina-320",
    "body:not(.render) .vrata{padding-bottom:0!important}",
    () => parseFloat(getComputedStyle(document.getElementById("vrata")).paddingBottom) < 4,
    "vrata"],

  ["manjkajoča površina ne more tihočati", "varovalka", "slog", "namizje",
    "#vrata{display:none!important}",
    () => getComputedStyle(document.getElementById("vrata")).display === "none", null],

  ["oba vzorca morata biti slika istega trenutka", "enako", "js", "namizje",
    `window.__m = 0; setInterval(() => { window.__m++;
       document.getElementById("klapa-kader").textContent = "k" + String(window.__m).padStart(2, "0"); }, 200);`,
    () => !!window.__m, null],

  ["premaknjen napis v pokončnem kadru", "izrob", "slog", "pokonci 9x16",
    /* Pokončnemu napisu ne vlada --rob-s, ampak skladba body.pokonci .napisi
       (zgodba.css:347). Okvara mora tipati na dejanski ročici, sicer bi bila
       neveljavna in bi vrata lažno pokazala "uredu". */
    "body.pokonci .napisi{bottom:175px!important}",
    () => Math.round(innerHeight - document.querySelector(".napisi").getBoundingClientRect().bottom) === 175, null],

  ["premaknjen napis v ležečem kadru", "izrob", "slog", "leznik 16x9",
    ":root{--rob-s:175px!important}",
    () => Math.round(innerHeight - document.querySelector(".napisi").getBoundingClientRect().bottom) === 175, null],

  ["izvoznik bi dobil živo varno cono po meri", "izvnosno", "js", "pokonci 9x16",
    /* Vgrinjamo v pokončno okno, kjer --rob-s napisa ne premika: sicer bi se
       oglasila še trditev izrob in ne bi vedeli, katera je živa. */
    `document.documentElement.style.setProperty("--rob-s", "150px");`,
    () => document.documentElement.style.getPropertyValue("--rob-s") !== "", null],

  ["izvoznik bi videl predvajalnikovo opremo", "izoprema", "slog", "pokonci 9x16",
    ".transport,.klapa{display:flex!important}",
    () => getComputedStyle(document.getElementById("transport")).display !== "none", null]
];

let UBIJ = () => {};
(async () => {
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}\\cdp-zmut-${Date.now()}`,
    "--no-first-run", "--window-size=1500,1000", "about:blank"], { stdio: "ignore" });
  UBIJ = () => { try { chrome.kill(); } catch { } };
  let v;
  for (let i = 0; i < 40; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await wait(400); }
  }
  if (!v) throw new Error("Chrome se ni zagnal");
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  let n = 0; const p = new Map();
  const send = (m, pr = {}, sid) => new Promise((res, rej) => {
    const id = ++n; p.set(id, { res, rej });
    ws.send(JSON.stringify(sid ? { id, method: m, params: pr, sessionId: sid } : { id, method: m, params: pr }));
  });
  ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.id && p.has(m.id)) {
      const q = p.get(m.id); p.delete(m.id);
      m.error ? q.rej(new Error(JSON.stringify(m.error))) : q.res(m.result);
    }
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const sess = (m, pr = {}) => send(m, pr, sessionId);
  const ev = async ex => {
    const r = await sess("Runtime.evaluate", { expression: ex, returnByValue: true });
    if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description || r.exceptionDetails));
    return r.result.value;
  };
  await sess("Page.enable"); await sess("Runtime.enable");
  const postavi = z => sess("Emulation.setDeviceMetricsOverride", z);

  const pripravi = async (url, w, h) => {
    await postavi({ width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await sess("Page.navigate", { url });
    for (let i = 0; i < 120; i++) {
      if (await ev("!!document.querySelector('.napisi') && typeof seznam !== 'undefined' && seznam.length > 0")) break;
      await wait(120);
    }
    await wait(900);
  };
  const napotuj = async () => {
    await sess("Page.navigate", { url: NASLOV });
    for (let i = 0; i < 120; i++) {
      if (await ev("!!document.getElementById('platno') && typeof seznam !== 'undefined' && seznam.length > 0")) break;
      await wait(120);
    }
  };
  /* Živi vzorec dobi vrsto "sonda": brez nje klici() ne ve, kaj naj sodi, in
     izpade kot tarča, ki je nikče ni vstal. */
  const vzorec = async () => { await wait(820);
    return { ...JSON.parse(await ev(IZRAZ)), vrsta: "sonda" }; };
  const vzemiDva = async () => { const a = await vzorec(); await wait(360); return [a, await vzorec()]; };
  const doDna = async () => {
    await ev("(() => { const v = document.getElementById('vrata'); v.scrollTop = v.scrollHeight; })()");
    const c = await vzorec();
    if (!c.zadajVrata || c.zadajVrata.ostalo !== 0)
      throw new Error(`vrata se niso zavrtila do dna (${c.zadajVrata ? c.zadajVrata.ostalo + " px" : "ni vrat"})`);
    return c;
  };
  /* Izvozna meritev: ista sonda kot v rka-zgodba-sonda.cjs, a z imenom cilja,
     da mutacija ve, kaj naj bi se oglasilo.
     BRATI je ločeno OD NAPOTITI: navigacija odnese vstrejeni slog, pa bi bila
     izvozna meritev vedno čista — prva različica teh vrat je prav tako lajala. */
  const odpriIzvoz = async i => { await pripravi(i.url, i.w, i.h); };
  const meriIzvoz = async i => {
    const m = await ev(`(() => { const n = document.querySelector('.napisi').getBoundingClientRect();
      return { odstop: Math.round((innerHeight - n.bottom) * 100) / 100,
        vpeto: getComputedStyle(document.documentElement).getPropertyValue('--rob-s').trim(),
        vnosno: document.documentElement.style.getPropertyValue('--rob-s'),
        transport: getComputedStyle(document.getElementById('transport')).display,
        klapa: getComputedStyle(document.getElementById('klapa')).display }; })()`);
    return { ...m, vrsta: "izvoz", cak: i.rob };
  };
  const zivi = async z => {
    await postavi(Z(z.name));
    await napotuj();
    return z.korak === "vrata" ? await doDna() : (await vzemiDva())[1];
  };
  const CISTA = o => klici(o).length === 0;

  console.log(`SONDA ${SONDA.length} znakov iz ${VIR}, prosti razredi ` +
    `${JSON.stringify(NAMENOMA)}, zaslonov ${ZASLONI.length}, izvoznih oken ${IZVOZ.length}.`);

  /* --- IZHODIŠČE: vsak zaslon in vsako izvozno okno, ki ga rabi kakšna okvara --*/
  const IZVOZNA = new Set(IZVOZ.map(x => x.ime));
  const ziviZ = [...new Set(MUTACIJE.filter(m => !IZVOZNA.has(m[3])).map(m => m[3]))];
  const izvozni = [...new Set(MUTACIJE.filter(m => IZVOZNA.has(m[3])).map(m => m[3]))];
  const izhodi = {};
  for (const z of ziviZ) {
    const korak = MUTACIJE.some(m => m[3] === z && m[6] === "vrata") ? "vrata" : null;
    await postavi(Z(z));
    await napotuj();
    const [a, b] = await vzemiDva();
    const o = korak === "vrata" ? await doDna() : b;
    o.name = z; o.korak = korak;
    izhodi[z] = o;
    const razlika = Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    const padec = razlika.length > 0 || !CISTA(o);
    console.log(`izhodišče ${z.padEnd(16)} ${STEUJE(o)}` + (padec
      ? `  !! že pade${razlika.length ? " (vzorca se razlikujeta v: " + razlika.join(",") + ")" : ""}` : ""));
  }
  for (const ime of izvozni) {
    const i = IZVOZ.find(x => x.ime === ime);
    if (!i) { console.error(`SMRT: izvozno okno "${ime}" ni v IZVOZ.`); process.exit(2); }
    await odpriIzvoz(i);
    const o = await meriIzvoz(i);
    izhodi[ime] = o;
    console.log(`izhodišče ${ime.padEnd(16)} ${STEUJE(o)}${CISTA(o) ? "" : "  !! že pade"}`);
  }
  if (Object.values(izhodi).some(o => !CISTA(o))) {
    console.log("\n→ NI V REDU: izhodišče ni čisto, mutacij se ne da oceniti. Najprej pogoni sondo.");
    UBIJ(); process.exitCode = 1; return;
  }
  console.log("→ izhodišča čista, lahko ocenjujemo vrata.\n");

  let ujetih = 0;
  for (const [ime, trditev, vrsta, cilj, koda, dokaz, korak] of MUTACIJE) {
    /* Isti uvod za obe družini: živa meritev dobi zaslon obiskovalca, izvozna
       pa okno in naslov, ki ju rabi rka-render.cjs. */
    const i = IZVOZ.find(x => x.ime === cilj);
    const vstri = () => ev(vrsta === "slog"
      ? `(() => { const st = document.createElement('style'); st.id = 'mutacija'; st.textContent = ${JSON.stringify(koda)}; document.head.appendChild(st); })()`
      : koda);
    const odpri = async () => i ? await odpriIzvoz(i)
      : (await postavi(Z(cilj)), await napotuj());
    await odpri();
    await vstri();
    await wait(950);
    const vpliv = await ev(`(() => { try { return !!(${dokaz.toString()})(); } catch (e) { return "napaka: " + e.message; } })()`);
    let z, a;
    if (i) z = await meriIzvoz(i);
    else {
      [a, z] = await vzemiDva();
      if (korak === "vrata") z = await doDna();
    }
    const klic = klici(z);
    const u = trditev === "enako" ? (a.kader !== z.kader && klic.length === 0)
      : klic.length === 1 && klic[0] === trditev;
    const nicelna = JSON.stringify({ ...z, name: undefined, korak: undefined }) ===
      JSON.stringify({ ...izhodi[cilj], name: undefined, korak: undefined });
    /* obnova stanja = nov zagon strani brez okvare, na istem cilju */
    await odpri();
    const cisti = i ? await meriIzvoz(i) : await vzorec();
    const obnova = CISTA(cisti);
    console.log(`${u && !nicelna && vpliv === true && obnova ? "UJETA      " : "SPODLETELA "} ${ime.padEnd(48)} [${trditev}] na ${cilj}`);
    console.log(`   okvara v dokumentu: ${vpliv === true ? "da" : vpliv} · oglasilo se: ${klic.join(",") || "nič"} · ${STEUJE(z)}`);
    if (vpliv !== true) console.log("   mutacija je NEVELJAVNA: okvara se na strani ne pozna.");
    else if (nicelna) console.log("   mutacija je NEVELJAVNA: meritev ob njej ostane enaka kot brez nje.");
    else if (!u) console.log(`   vrata so GLUHA ali MEŠANE: pričakovali smo samo "${trditev}", ` +
      `dobili ${klic.join(",") || "nič"}` + (trditev === "enako" ? ` (vzorca ${a && a.kader} / ${z.kader})` : ""));
    if (!obnova) console.log(`   po okvari stran NE ostane čista: ${STEUJE(cisti)}`);
    if (z.namenoma && z.namenoma.length) console.log(`   (namenoma: ${z.namenoma.slice(0, 2).join(" | ")})`);
    if (u && !nicelna && vpliv === true && obnova) ujetih++;
  }

  console.log(`\n--- presoja ---`);
  console.log(`${ujetih}/${MUTACIJE.length} okvar ujetih, ${MUTACIJE.length - ujetih} spodletelih ali neveljavnih`);
  console.log(ujetih === MUTACIJE.length ? "V REDU" : "NI V REDU");
  ws.close(); UBIJ();
  process.exitCode = ujetih === MUTACIJE.length ? 0 : 1;
})().catch(e => { console.error("SMRT:", e.message); UBIJ(); process.exit(2); });
