/* Vrata za GIB kadrov. rka-zgodba-sonda.cjs meri geometrijo napisa in platna,
   rka-pokonci-preveri.cjs širino pasu — nobena od njiju ne vidi, kaj se med
   vzorčenjem dogaja s sliko. Živost giba je bila doslej trditev, izrečena po
   pregledu nekaj posnetih okvirjev, kar ni dokaz: gib se zgodi v 1800 trenutkih
   minute, vzorčenje na petih okvirjih pa ga ne more pokazati.

   Vrata trdijo osem stvari, vse izmerjene iz dejansko izrisanega okna, ne iz
   formule:
   1) ROB: vsak vzorčen trenutek (30 Hz) prekrije naslikano črnilo kadra vidno okno — gib
      torej nikoli ne razkrije podlage, ki bi jo sicer prekrival. Črnilo je unija
      ostre slike in zabrisanega nadaljevanja pod njo (::before), vidno okno pa
      okvir kadra, pokrajčan na platno. Oster rob pasu meri samo kot številko
      (dvig), ne kot trditev: pas v 9:16 rezu celega platna ne pokriva in ne bi smel.
   2) PORIV: pod tistim pasom je res slikovno nadaljevanje — izračunana vrednost
      zabrisanega sloja ::before vsebuje url, torej je črnilo res narisano iz
      fotografije in ne iz temnega platna. Brez te trditve ROB v pokončnem rezu ne
      pomeni ničesar, saj rob pasu med gibom zaniha; meri se na vsakem kadru
      posebej, ne predpostavi se iz komentarja v CSS.
   3) PRESLIKAVA: matrika, s katero sonda računa pravokotnik zabrisanega sloja, v
      vsakem vzorčenem trenutku napove izmerjen pravokotnik sloja z napako pod
      0,5 px. Brez tega bi bil lahko ROB zmago zaradi enačbe, ki ne velja.
   4) KONC: na začetku in na koncu okna sta povečava in zamik kadra enaka vrednostim
      izpred živega giba (1,02 / 1,12 / 1,14 in ±0,6 / ±0,5 / ±3,4 %), znotraj
      dovoljene roke — ublažitev sme spremeniti POT do točke, ne pa same točke;
   5) UTRIP: v drugi polovici okna, kjer se je odmev že usedel, je prirastek
      povečave v prvih 10 % te polovice vsaj 2-krat večji kot v zadnjih 10 % — le
      tako se ublažitev pozna kot upočasnitev pred rezom in ne kot linearni drsnik;
   6) DETERMINIZEM: isti čas vrne identično transformacijsko nit, tudi če se med
      meritvijo skocamo po časovnem listu; sosednji čas mora vrniti drugačno, sicer
      bi bila trditev izpolnjena kar z nedelovanjem. Brez determinizma izvoznik ne
      more obljubiti, da bo drugi render enak prvemu;
   7) ŽIVA STRAN: predvajalnik brez ?render=1 giba enako kot izvoznik, da
      oglaseni pokončni izdelek ni skrit pred obiskovalcem na telefonu;
   8) SMER: smer prenosa se meri na izrisu, ne iz tabele v JS. Sredi prehoda
      (0,10 in 0,22 s od začetka okna) mora rob izrezanega vidnega območja
      prihajajočega kadra — odčitan iz izračunanega clip-path — in pot vodne
      črte #reznica oba kazati v smer, ki jo zahteva pravilo teh vrat: kader,
      ki potuje desno (push, panR), se razkriva desno; kader, ki potuje levo
      (pull, panL), se razkriva levo. Pričakovanje pride iz giba v spot.json in
      iz pravila, zapisanega tukaj; sonda namerno ne bere SMER_PREHODA iz
      zgodba.js, zato se njen obrat ne more zgoditi neopazeno.

   Zakaj se konstante ne prebirajo iz vira: vrata, ki napovedujejo izmerjeno
   vrednost z isto formulo, ki jo merijo, ne morejo pasti nobene napake v formuli.
   Številke v TOČKE so zato zapisane ročno — to so konci linearne različice, ki je
   bila odobrena in izvožena (rka-60-sl-splet.mp4 in dr.).

   Uporaba: node rka-gib-sonda.cjs [--pogled=<id kadra>] — izpiše tudi pot
   povečave enega kadra, kadar si hočeš ogledati številke, ne samo sodb. */
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const { zzeni } = require("./rka-streznik.cjs");
const PORT = 9451;
const wait = ms => new Promise(r => setTimeout(r, ms));
const POGLED = (process.argv.find(a => a.startsWith("--pogled=")) || "").split("=")[1];

/* Konči linearnega giba pred živostjo (zgodba.js pred igerijo 2026-10-26), v
   delezh lastnega lay-out okvira. pull se na koncu OKNO vrne na 1,02, ne ostane na
   1,12 — obratna smer je tudi obraten začetek. */
const TOČKE = {
  push: { zac: { s: 1.02, x: 0, y: 0 }, kon: { s: 1.12, x: 0.6, y: -0.5 } },
  pull: { zac: { s: 1.12, x: 0, y: 0 }, kon: { s: 1.02, x: -0.6, y: 0.5 } },
  panL: { zac: { s: 1.14, x: 3.4, y: 0 }, kon: { s: 1.14, x: -3.4, y: 0 } },
  panR: { zac: { s: 1.14, x: -3.4, y: 0 }, kon: { s: 1.14, x: 3.4, y: 0 } }
};
/* Dovoljena odklona: roka sme zamik prepricati do 1,5-kratne zasnove amplitude
   (0,28 % · 1,5 sirine in 0,20 % · 1,5 visine), odmev pa sme na koncu okna pustiti
   največ 0,15 % povečave. */
const ROB_SKALA = 0.0015, ROB_ZAMIK_X = 0.42, ROB_ZAMIK_Y = 0.30;

const SEJE = [
  { ime: "izvoz ležeče :60", raz: "16x9", rez: "60", render: true },
  { ime: "izvoz ležeče :30", raz: "16x9", rez: "30", render: true },
  { ime: "izvoz pokončno :60", raz: "9x16", rez: "60", render: true },
  { ime: "izvoz pokončno :30", raz: "9x16", rez: "30", render: true },
  { ime: "živa stran :60", raz: "16x9", rez: "60", render: false }
];

const SODA = `(() => {
  const SRICJE = 30;
  const PLATNO = document.querySelector('#platno').getBoundingClientRect();
  const SLED = ${JSON.stringify(TOČKE)};
  const rezultat = { kadri: [], pricakovani: 0, platno: { w: +PLATNO.width.toFixed(1), h: +PLATNO.height.toFixed(1) } };
  const vOkn = (el, B) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    /* Zapis scale(s) translate(p) premakne središče za s·p, zato delimo še s povečavo:
       brez tega bi bil zamik v meritvi videti 12 % vecji kot v zapisu. */
    return { s: m.a, x: 100 * m.e / (B.width * m.a), y: 100 * m.f / (B.height * m.a) };
  };

  rezultat.pricakovani = seznam.filter(v => v.kader.vrsta === 'slika' && v.gib && SLED[v.kader.gib]).length;

  seznam.forEach((v, i) => {
    if (v.kader.vrsta !== 'slika' || !v.gib) return;
    const gib = v.kader.gib;
    const TO = SLED[gib];
    if (!TO) return;
    const el = v.gib;
    const med = el.querySelector('img,video') || el;
    izris(v.zacetek);
    const shrani = el.style.transform;
    el.style.transform = 'none';
    const SIZ = el.getBoundingClientRect();
    const OKNO = (el.closest('.kader') || el).getBoundingClientRect();
    const R0 = med.getBoundingClientRect();
    el.style.transform = shrani;
    /* Črnilo kadra = VSE, kar gib dejansko naslika: oster pas (v ležečem rezu
       celotna slika) IN zabrisano nadaljevanje pod njim, ki ga nosi ::before.
       Referenca ni kar platno bi moralo biti prekrito, ne rob platna in ne rob
       pasu: v pokončnem rezu je namreč kar sam sloj enak platnu (rob == okno),
       zato bi meritev čez sloj napovedala izpostavljenost povsod, kjer se platno
       ni povečalo za več, kot zamik požre. */
    const ST = getComputedStyle(el);
    const BR = getComputedStyle(el, '::before');
    const crta = !!(BR.content && BR.content !== 'none' && BR.content !== 'normal');
    const izvor = String(ST.transformOrigin || '50% 50%').split(' ').filter(s => s.length);
    const del = (vred, velikost) => vred.indexOf('%') >= 0
      ? velikost * parseFloat(vred) / 100 : parseFloat(vred);
    const OX = SIZ.left + del(izvor[0] || '50%', SIZ.width);
    const OY = SIZ.top + del(izvor[1] || '50%', SIZ.height);
    const PLATNO_R = document.querySelector('#platno').getBoundingClientRect();
    const B = {
      left: Math.max(OKNO.left, PLATNO_R.left), right: Math.min(OKNO.right, PLATNO_R.right),
      top: Math.max(OKNO.top, PLATNO_R.top), bottom: Math.min(OKNO.bottom, PLATNO_R.bottom)
    };
    if (B.right - B.left < 1 || B.bottom - B.top < 1)
      throw new Error('kader ' + v.id + ': vidno okno se zniči');
    /* Mirni pravokotnik zabrisanega nadaljevanja: usedna vrednost insetov,
       odčitana iz izračunanega sloga pseudoelementa, ne iz CSS datoteke. */
    const F0 = crta ? {
      left: SIZ.left + parseFloat(BR.left), right: SIZ.right - parseFloat(BR.right),
      top: SIZ.top + parseFloat(BR.top), bottom: SIZ.bottom - parseFloat(BR.bottom)
    } : null;
    /* Pravokotnik se preslika čez izmerjeno matriko, ker pseudoelement nima svojega
       meritvenega razreza. Formula se sme uporabiti samo tam, kjer se ujema z
       izmerjenim pravokotnikom sloja; to trditev v vsakem vzorčenem trenutku
       preverja PRESLIKAVA. */
    const preslika = (R, m) => {
      const a = [OX + m.a * (R.left - OX) + m.e, OX + m.a * (R.right - OX) + m.e];
      const b = [OY + m.d * (R.top - OY) + m.f, OY + m.d * (R.bottom - OY) + m.f];
      return { left: Math.min(a[0], a[1]), right: Math.max(a[0], a[1]),
               top: Math.min(b[0], b[1]), bottom: Math.max(b[0], b[1]) };
    };
    /* Pod tistim pasom mora BITI slika, ne prazno ozadje: brez nje bi bilo zabrisano
       nadaljevanje kar temno platno, in takrat vsak dvig roba razkrije podlogo,
       čeprav geometrija ni videti pretesna. Meri se IZRISEN sloj — izračunana
       vrednost ::before, kjer je že opravljena zamenjava spremenjke — ne lastnost
       --k-slika na sloju: tista je samo nastavljena v JS in bi ostala prisotna tudi,
       če je CSS pravilo nikoli ne bi porabilo. */
    const poriv = crta && (BR.backgroundImage || '').indexOf('url(') >= 0;

    const N = Math.max(6, Math.round(v.okno * SRICJE));
    const vzorci = [];
    /* Rob je PREKRIVNI zamik v px: pozitivno pomeni, da črnilo okno presega in ga
       torej zapre povsem; negativno pomeni izpostavljen rob. Predznak je bil v
       prvem zapisu obrnjen, zato je bilo varno odstopanje (slika je velika 116 %
       platna) kar 79 lažnih napak. */
    let rob = { l: 1e9, r: 1e9, t: 1e9, b: 1e9 };
    let dvig = 0, odstop = 0;
    for (let k = 0; k <= N; k++) {
      const od = Math.min(v.okno - 1e-4, k * v.okno / N);
      izris(v.zacetek + od);
      const A = el.getBoundingClientRect();
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      const P = preslika(SIZ, m);
      odstop = Math.max(odstop, Math.abs(P.left - A.left), Math.abs(P.right - A.right),
                        Math.abs(P.top - A.top), Math.abs(P.bottom - A.bottom));
      const C = F0 ? preslika(F0, m) : A;
      const S = med.getBoundingClientRect();
      rob.l = Math.min(rob.l, B.left - Math.min(S.left, C.left));
      rob.r = Math.min(rob.r, Math.max(S.right, C.right) - B.right);
      rob.t = Math.min(rob.t, B.top - Math.min(S.top, C.top));
      rob.b = Math.min(rob.b, Math.max(S.bottom, C.bottom) - B.bottom);
      /* Ostri spodnji rob pasu: kolikšno širino pod seboj razkrije, kadar gib pas
         dvigne. Ni trditev — pod njim je zabrisano nadaljevanje iste slike, kar
         dokazuje PORIV — je pa številka, ki jo je treba videti. */
      dvig = Math.max(dvig, R0.bottom - S.bottom);
      const vk = vOkn(el, SIZ);
      vzorci.push({ od, s: vk.s, x: vk.x, y: vk.y });
    }
    /* SMER: smer prehoda se meri na IZRISENEM rezultatu in ne iz tabele v JS.
       Dva neodvisna signala, vzeta sredi prehoda (REZ_TRAJANJE 0,30 s): rob
       izrezanega vidnega območja prihajajočega kadra, odčitane iz izračunanega
       clip-path, in pot vodne črte #reznica med dvema urama. Pričakovanje pride
       iz pravila, zapisanega v teh vratih — prihajajoči kader, ki potuje desno
       (push, panR), se razkriva desno; kader, ki potuje levo (pull, panL), se
       razkriva levo — in iz giba v spot.json. Smeri tabele SMER_PREHODA v
       zgodba.js sonda ne bere, zato njena obrnitev pade sem. */
    const PRICAKOVANA_SMER = { push: 1, panR: 1, pull: -1, panL: -1 };
    let smer = null;
    if (i > 0 && PRICAKOVANA_SMER[gib]) {
      const robSmer = (t) => {
        izris(t);
        const cp = String(getComputedStyle(v.el).clipPath || 'none');
        /* Oba vzorca morata imeti PODVOJENE povratne poševnice: ta odsek je del
           predloge SODA, ta pa je predlogoslovni niz, kjer ena sama povratna
           poševnica vzame samega sebe. Brez podvojitve bi v brskalniku ostal
           vzorec za črko s, ki razbije niz ob njej in ne ob presledku. */
        const m = cp.match(/inset\\(([^)]*)\\)/);
        if (!m) return 0;
        /* Browser vrne enote mešano ("0px 66.67% 0px 0px"), zato parseFloat in
           ne Number: slednji bi "66.67%" vrnil kot NaN in mera bi bila nič. */
        const d = m[1].trim().split(/\\s+/).map(parseFloat);
        if (d.some(x => !Number.isFinite(x))) return 0;
        const s4 = [d[0], d[1] !== undefined ? d[1] : d[0],
                    d[2] !== undefined ? d[2] : d[0],
                    d[3] !== undefined ? d[3] : (d[1] !== undefined ? d[1] : d[0])];
        if (s4[3] > 0 && s4[1] === 0) return -1;   // lev izrez raste od desne
        if (s4[1] > 0 && s4[3] === 0) return 1;    // desni izrez raste od leve
        return 0;
      };
      const crtaX = (t) => {
        izris(t);
        const R = document.querySelector('#reznica').getBoundingClientRect();
        return R.width > 0 ? (R.left + R.right) / 2 : null;
      };
      const r1 = robSmer(v.zacetek + 0.10), r2 = robSmer(v.zacetek + 0.22);
      const x1 = crtaX(v.zacetek + 0.10), x2 = crtaX(v.zacetek + 0.22);
      izris(v.zacetek + 0.10);
      smer = {
        pricakovana: PRICAKOVANA_SMER[gib], rob1: r1, rob2: r2,
        suro: String(getComputedStyle(v.el).clipPath),
        crta: x1 === null || x2 === null ? null : Math.sign(x2 - x1),
        pot: x1 === null || x2 === null ? null : +(x2 - x1).toFixed(2)
      };
    }

    /* Determinizem: ista ura pred in po celotnem preskoku; sosednja ura mora
       vrniti drug vrednost, sicer meritve ne ločimo od nicelnega pisa. */
    const t0 = v.zacetek + Math.min(v.okno - 0.3, 1.2);
    izris(t0); const d1 = el.style.transform;
    izris(seznam[seznam.length - 1].konec - 0.05);
    izris(v.zacetek + 0.05);
    izris(t0); const d2 = el.style.transform;
    izris(t0 + 1 / SRICJE); const d3 = el.style.transform;

    const prvi = vzorci[0], zadnji = vzorci[vzorci.length - 1];
    const pot = (a, b) => {
      const i = Math.round(N * a), j = Math.round(N * b);
      return Math.abs(vzorci[Math.min(N, j)].s - vzorci[Math.max(0, i)].s);
    };
    rezultat.kadri.push({
      id: v.id, gib, okno: +v.okno.toFixed(3), dvig: +dvig.toFixed(2), poriv,
      odstop: +odstop.toFixed(2), crta,
      g: {
        siz: [+SIZ.width.toFixed(1), +SIZ.height.toFixed(1)],
        okno: [+OKNO.width.toFixed(1), +OKNO.height.toFixed(1)],
        r0: [+R0.width.toFixed(1), +R0.height.toFixed(1)],
        a: [+el.getBoundingClientRect().width.toFixed(1), +el.getBoundingClientRect().height.toFixed(1)],
        am: [+med.getBoundingClientRect().width.toFixed(1), +med.getBoundingClientRect().height.toFixed(1)]
      },
      rob: { l: +rob.l.toFixed(2), r: +rob.r.toFixed(2), t: +rob.t.toFixed(2), b: +rob.b.toFixed(2) },
      zac: { s: +prvi.s.toFixed(5), x: +prvi.x.toFixed(3), y: +prvi.y.toFixed(3),
             ds: +Math.abs(prvi.s - TO.zac.s).toFixed(5) },
      kon: { s: +zadnji.s.toFixed(5), x: +zadnji.x.toFixed(3), y: +zadnji.y.toFixed(3),
             ds: +Math.abs(zadnji.s - TO.kon.s).toFixed(5),
             dx: +Math.abs(zadnji.x - TO.kon.x).toFixed(3),
             dy: +Math.abs(zadnji.y - TO.kon.y).toFixed(3) },
      utrip: { znotraj: +pot(0.5, 0.6).toFixed(5), zunaj: +pot(0.9, 1.0).toFixed(5) },
      smer,
      determinizem: !!(d1 && d1 === d2 && d3 !== d1),
      pot: vzorci.map(w => [+w.od.toFixed(3), +w.s.toFixed(5), +w.x.toFixed(3), +w.y.toFixed(3)])
    });
  });
  return JSON.stringify(rezultat);
})()`;

const CISTI = [];
(async () => {
  /* Profil mora biti vsakič svoj. Skupno ime je rodilo dva poraza zapored:
     prvič je čistilec brisal ime, ki ga zagon nikoli ni ustvaril, zato jih je
     v TEMP ostalo 44; drugič je brisanje ob izhodu padlo na EPERM (taskkill
     ročaje sprosti šele po vrnitvi), naslednji zagon pa je isti zaklenjen
     imenik poskusil pobrisati pred zagonom in nezajeta napaka je ubila celotno
     mero. Vsak zagon torej dobi svoj imenik; njegov čistilec ga pobriše ob
     izhodu, ob zagonu pa pobere še vse stare, ki jih nihče več ne drži. */
  const KOREN = `${process.env.TEMP}\\cdp-gib`;
  try { fs.rmSync(KOREN, { recursive: true, force: true }); } catch { }
  let stari = 0;
  for (const ime of fs.readdirSync(process.env.TEMP)) {
    if (!ime.startsWith("cdp-gib-")) continue;
    const pot = `${process.env.TEMP}\\${ime}`;
    try {
      if (Date.now() - fs.statSync(pot).mtimeMs > 20 * 60 * 1000) { fs.rmSync(pot, { recursive: true, force: true }); stari++; }
    } catch { /* imenik še drži kak Chrome — pobere ga naslednji zagon */ }
  }
  const PROFIL = `${KOREN}-${process.pid}-${Date.now()}`;
  CISTI.push(() => {
    for (let i = 0; i < 3; i++) {
      try { fs.rmSync(PROFIL, { recursive: true, force: true }); return; }
      catch { /* Chrome še drži ročaje: počakaj in poskusi znova */ }
      const kon = Date.now() + 700; while (Date.now() < kon) { }
    }
  });
  let streznik = null, vrata = 0;
  for (const p of [4194, 4195, 4196, 4197]) {
    try { streznik = await zzeni("C:\\Users\\admin\\Downloads\\sssdf\\rka-onepage", p); vrata = p; break; }
    catch { /* zasedeno, poskusi naprej */ }
  }
  if (!streznik) { console.log("KONEC\nNI V REDU: prostih ni streznikovih vrat (4194-4197)."); process.exit(2); }
  CISTI.push(() => streznik.close());

  /* Port mora biti PROST, preden sploh zspawnamo: taskkill vrne nadzor, preden
     jedro sprosti vmesnik. Ce novi Chrome najde 9451 zaseden, tiho vzame nakljucna
     vratna in cakanje na 9451 pade po 60 s kot okoljska napaka — harness je nato
     porabil polovico casa za ponovitve. */
  for (let i = 0; i < 60; i++) {
    let zaseden = false;
    try { await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); zaseden = true; }
    catch { /* brez odgovora pomeni prosto */ }
    if (!zaseden) break;
    await wait(500);
    if (i === 59) console.log("   opozorilo: port " + PORT + " je še zaseden po 30 s čakanja.");
  }

  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
    "--force-device-scale-factor=1", `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFIL}`,
    "--no-first-run", "about:blank"
  ], { stdio: "ignore" });
  CISTI.push(() => {
    try { spawnSync("taskkill", ["/T", "/F", "/PID", String(chrome.pid)], { stdio: "ignore" }); }
    catch { chrome.kill(); }
  });

  let v;
  /* 60 s namesto 18 s: ko Chrome potrebuje več časa za zagon, kratka meja pade
     kot okoljska napaka, poskus pa je videti kot pokvarjena mera. */
  for (let i = 0; i < 120; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await wait(500); }
  }
  if (!v) { console.log("KONEC\nNI V REDU: Chrome se ni zagnal na portu " + PORT + " v 60 s."); process.exit(2); }

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
  const izvedi = async (izraz, sid) => {
    const r = await send("Runtime.evaluate", { expression: izraz, returnByValue: true, awaitPromise: true }, sid);
    if (r.exceptionDetails) throw new Error("JS: " + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  };

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: sid } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sid);
  await send("Runtime.enable", {}, sid);

  const seje = {};
  for (const s of SEJE) {
    const w = s.raz === "9x16" ? 1080 : 1920, h = s.raz === "9x16" ? 1920 : 1080;
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false }, sid);
    await send("Page.navigate",
      { url: `http://127.0.0.1:${vrata}/zgodba.html` + (s.render ? "?render=1&razmerje=" + s.raz : "") }, sid);
    let g = false;
    for (let i = 0; i < 40; i++) {
      if ((await izvedi("document.readyState", sid)) === "complete") { g = true; break; }
      await wait(400);
    }
    if (!g) throw new Error("stran se ni naložila: " + s.ime);
    await wait(1200);
    if (s.render) await izvedi(`(() => { const g = document.getElementById('vBrezZvoka'); if (!g) throw new Error('gated ni na voljo'); g.click(); return 1; })()`, sid);
    await izvedi(`ustavi(); nastaviRez(${JSON.stringify(s.rez)}); nastaviJezik("sl"); 1`, sid);
    await wait(1600);
    await izvedi(`(async () => { const s = [...document.querySelectorAll('.kader img')];
      await Promise.all(s.map(i => i.decode().catch(() => {}))); return 1; })()`, sid);
    if (s.render) {
      const r = await izvedi(`JSON.stringify({ raz: stanje.razmerje, pokonci: document.body.classList.contains('pokonci'), render: true })`, sid);
      const pre = JSON.parse(r);
      if (pre.raz !== s.raz || pre.pokonci !== (s.raz === "9x16"))
        throw new Error(`${s.ime}: platno je v razmerju ${pre.raz}, zahtevano ${s.raz}`);
    }
    seje[s.ime] = JSON.parse(await izvedi(SODA, sid));
    console.log(`--- seja ${s.ime}: ${seje[s.ime].kadri.length} kadrov giba, platno ${seje[s.ime].platno.w}×${seje[s.ime].platno.h} px`);
    if (POGLED) {
      const k = seje[s.ime].kadri.find(x => x.id === POGLED);
      if (k) {
        console.log("    geometrija " + k.id + " (šir×višina): sloj v miru " + k.g.siz +
          " · okvir " + k.g.okno + " · slika v miru " + k.g.r0 +
          " · slojeva izmera " + k.g.a + " · slika " + k.g.am);
        if (s.ime === "izvoz ležeče :60")
          console.log("    pot " + k.id + ": " + k.pot.filter((_, i) => i % 4 === 0).map(p => `${p[0]}s→${p[1]}`).join("  "));
      }
    }
  }

  /* --- presoja --- */
  const napake = [];
  let brezCrte = 0;
  for (const s of SEJE) {
    const podatki = seje[s.ime].kadri;
    if (podatki.length < 1) napake.push(`${s.ime}: noben kader giba ni izmerjen.`);
    else if (podatki.length !== seje[s.ime].pricakovani)
      napake.push(`${s.ime}: izmerjenih ${podatki.length} od ${seje[s.ime].pricakovani} kadrov giba — sonda je katerega preskočila.`);
    for (const k of podatki) {
      const najSl = Math.min(k.rob.l, k.rob.r, k.rob.t, k.rob.b);
      if (najSl < 0) napake.push(`ROB ${s.ime}/${k.id}: sloj je za ${(-najSl).toFixed(1)} px manjši od vidnega okna (${JSON.stringify(k.rob)}).`);
      if (s.raz === "9x16" && !k.poriv)
        napake.push(`PORIV ${s.ime}/${k.id}: pod pasom ni slike (--k-slika je prazen ali pa zabrisanega sloja sploh ni), zato bi vsak dvig ostrega roba razkril platno.`);
      if (k.odstop > 0.5)
        napake.push(`PRESLIKAVA ${s.ime}/${k.id}: matrika napove slojev pravokotnik z odstopanjem ${k.odstop} px — formula, s katero sonda računa rob zabrisanega nadaljevanja, ne ustreza izrisu.`);
      if (k.zac.ds > 0.02 || k.kon.ds > ROB_SKALA)
        napake.push(`KONC ${s.ime}/${k.id}: povečava izven linearnih koncev (začetek +${k.zac.ds}, konec ${k.kon.ds}).`);
      if (k.kon.dx > ROB_ZAMIK_X || k.kon.dy > ROB_ZAMIK_Y)
        napake.push(`KONC ${s.ime}/${k.id}: zamik na koncu okna odstopa (${k.kon.dx} % x, ${k.kon.dy} % y), meji ${ROB_ZAMIK_X} / ${ROB_ZAMIK_Y}.`);
      const giba = k.gib === "push" || k.gib === "pull";
      if (giba && !(k.utrip.znotraj > 2 * k.utrip.zunaj && k.utrip.zunaj > 0))
        napake.push(`UTRIP ${s.ime}/${k.id}: prirastek povečave v drugi polovici ${k.utrip.znotraj} proti ${k.utrip.zunaj} na robu — razmerje ni vsaj 2, torej gib ni ublažen.`);
      if (k.smer) {
        const e = k.smer.pricakovana;
        if (k.smer.rob1 !== e || k.smer.rob2 !== e)
          napake.push(`SMER ${s.ime}/${k.id}: rob prehoda je izmerjen kot ${k.smer.rob1}/${k.smer.rob2} (clip-path "${k.smer.suro}"), pravilo vrat za gib ${k.gib} zahteva ${e} — prehod se odpira v napačno smer.`);
        if (k.smer.crta === null) brezCrte++;
        else if (k.smer.crta !== e)
          napake.push(`SMER ${s.ime}/${k.id}: vodna črta potuje ${k.smer.crta} (${k.smer.pot} px), pravilo za gib ${k.gib} zahteva ${e} — clip-path in črta se ne ujemata.`);
      }
      if (!k.determinizem) napake.push(`DETERMINIZEM ${s.ime}/${k.id}: isti čas ne vrne iste transformacije ali pa je transformacija sploh ni.`);
    }
  }
  /* 5) živa stran mora gibati enako kot izvoznik. */
  const lz = seje["izvoz ležeče :60"].kadri, zv = seje["živa stran :60"].kadri;
  for (const a of lz) {
    const b = zv.find(x => x.id === a.id);
    if (!b) { napake.push(`ŽIVA STRAN: kader ${a.id} v živi strani ni izmerjen.`); continue; }
    for (let i = 0; i < Math.min(a.pot.length, b.pot.length); i++) {
      if (Math.abs(a.pot[i][1] - b.pot[i][1]) > 0.0008 || Math.abs(a.pot[i][2] - b.pot[i][2]) > 0.03) {
        napake.push(`ŽIVA STRAN: ${a.id} ob ${a.pot[i][0]} s kaže drug gib kot izvoznik (${a.pot[i][1]} proti ${b.pot[i][1]}).`);
        break;
      }
    }
  }

  if (brezCrte) console.log(`   SMER: vodne črte ni bilo mogoče meriti v ${brezCrte} prehodih (reduce-motion ali display:none) — tam o smeri odloča samo clip-path.`);
  console.log(`   profil: ${PROFIL.split("\\").pop()}, pobranih starih imenikov: ${stari}`);
  console.log("\n--- presoja: " + SEJE.length + " sej, " +
    SEJE.reduce((a, s) => a + seje[s.ime].kadri.length, 0) + " kadrov giba ---");
  for (const s of SEJE) {
    const k = seje[s.ime].kadri;
    const rob = Math.min(...k.map(x => Math.min(x.rob.l, x.rob.r, x.rob.t, x.rob.b)));
    const zamik = Math.max(...k.map(x => Math.max(x.kon.dx, x.kon.dy)));
    const utrip = Math.min(...k.filter(x => x.gib === "push" || x.gib === "pull")
      .map(x => x.utrip.znotraj / (x.utrip.zunaj || 1e-9)));
    const dvig = Math.max(...k.map(x => x.dvig));
    /* SMER se izpiše, da zeleni rezultat ni prazen niz: brez izpisa bi lahko
       trditev sploh ne tekla (smer = null) in vrata bi rekla V REDU. */
    const sm = k.filter(x => x.smer);
    const smSlog = sm.map(x => x.smer.rob1 === x.smer.pricakovana &&
      x.smer.rob2 === x.smer.pricakovana ? (x.smer.pricakovana > 0 ? "+" : "-") : "!");
    const smCrta = sm.map(x => x.smer.crta === null ? "?" :
      (x.smer.crta === x.smer.pricakovana ? "=" : "!"));
    const smPot = sm.filter(x => Number.isFinite(x.smer.pot)).map(x => Math.abs(x.smer.pot));
    console.log(`  ${s.ime.padEnd(20)} najslabsi rob ${rob.toFixed(1)} px · dvig pasu ${dvig.toFixed(1)} px · odkon zamika ${zamik.toFixed(3)} % · najslabsi utrip ${utrip.toFixed(2)}× · smer ${sm.length}/${k.length} [${smSlog.join("")}] crta [${smCrta.join("")}] pot ${smPot.length ? (smPot.reduce((a, b) => a + b) / smPot.length).toFixed(1) : "ni"} px`);
  }
  if (napake.length) {
    console.log("\n--- SLABO ---");
    for (const n of napake.slice(0, 20)) console.log("  " + n);
    if (napake.length > 20) console.log(`  ... in se ${napake.length - 20}`);
    console.log("KONEC");
    process.exit(1);
  }
  console.log("\nV REDU: noben gib ne razkrije podlage (črnilo povsod prekrije vidno okno in pod");
  console.log("pokončnim pasom je res slika), konce oken so tam kot pred živostjo, ublažitev se pozna");
  console.log("kot upočasnitev pred rezom, izvoz je ponovljiv in živa stran vidi isti gib.");
  console.log("KONEC");
  process.exit(0);
})().catch(e => { console.log("KONEC\nSMRT: " + e.message); process.exit(2); })
  .finally(() => { for (const f of CISTI.reverse()) { try { f(); } catch { /* ze zaprto */ } } });
