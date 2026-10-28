/* Vrata za FILMSKO stran. Sonda rka-drsenje-sonda.cjs dokazuje obljubo "brez
   drsenja" samo za index.html, ki ima svoj reševalec gostote (prilepi()).
   zgodba.html ima drug pogon — fluidne clamp() vrednosti in svh enote — zato
   zanj trditev doslej ni izmerila nobena vrata.

   Trdi sedem stvari:
   1) dokument ne more drsiti ne navpično ne vodoravno;
   2) noben element, ki NOSI BESEDO, ne štruri iz platu — razen tistih, ki jih
      prednik že seka (Ken Burns, okrajševalni naslov v klapi);
   3) noben element, ki nosi besedo, ni prerezan; šteje le tam, kjer element SAM
      preseka, sicer je to le višji ink-boks pisave in ne rez;
   4) noben besedni element ne leži v pasu transportnih kontrol;
   5) meritev se ponovi in mora ostati enaka, da ne sodimo sredi reza ali zabrisa;
   6) zadnja vrstica vrat je z zavrtjem dosegljiva NAD kontrole (na nizkem oknu
      vrata drsijo namesto tega, da bi bila tiho zrezana);
   7) izvoznik vidi zamrznjeno platno: živa odzivnost ne sme premakniti napisa
      ali razkriti opreme v kadru, ki je že predan kot MP4.

   Zakaj samo besedni elementi: platno NE SME biti zajeto v to trditev. Slika
   kadra je v ležečem rezu široka 1253 px pri levem robu −86 px (Ken Burns
   pomik), kar je videti kot prelivanje čez plato, a je presečeno z overflow in
   clip-path. Če bi to šteli kot napako, bi vrata lajala. */
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const { spawn } = require("child_process");
const PORT = 9431;
const NASLOV = "http://127.0.0.1:4183/zgodba.html";
const wait = ms => new Promise(r => setTimeout(r, ms));

/* Izvoznik odpre platno v teh oknih (rka-render.cjs:24), napis pa mora ostati enako
   od dna oddaljen kot v že predanih datotekah. Številka "rob" zato NI izračunana iz
   CSS aritmetike: prvi dve takšni izračunani številki sta bili napačna. Izmerjena je
   s slikami — rka-izvoz-okvir.cjs izriše današnji okvir, rka-izvoz-okvir.py ga
   primerja s predanima datotekama rka-60-sl-druzbeno-pokonci.mp4 in
   rka-60-sl-druzbeno.mp4 na treh urah (0,6 / 28,2 / 55,2 s). Izmerjeno 2026-10-25:
   premik 0 do 1 px, spodnja sled beznega besedila 144 proti 144 in 154 proti 153 px
   pokonci, 125 proti 125 in 135 proti 134 px ležeče.
   Od kod številki: pokonci vlada skladba zgodba.css:347 body.pokonci .napisi =
   clamp(64px, 9svh, 140px), kar v oknu, visokem 1920 px, reže na 140 px — napis tam
   NE sledi --rob-s. Ležeči izvoz ne doseže ozkega bloka, zato tam vlada osnovna
   vrednost (zgodba.css:22): 11,4 % od 1080 = 123,11 px.
   Kadar kdo dvigne eno od obeh lestvic, mora ta preizkus pasti, preden se spot
   ponovno izvozi in pregleda. */
const IZVOZ = [
  { ime: "pokonci 9x16", url: NASLOV + "?render=1&razmerje=9x16", w: 1080, h: 1920, rob: 140 },
  { ime: "leznik 16x9", url: NASLOV + "?render=1", w: 1920, h: 1080, rob: 123.11 }
];

const ZASLONI = [
  { ime: "telefon", w: 390, h: 844, dpr: 3, mobil: true },
  { ime: "s23u", w: 338, h: 731, dpr: 3, mobil: true },
  { ime: "namizje", w: 1440, h: 900, dpr: 1, mobil: false },
  { ime: "sirina-320", w: 320, h: 640, dpr: 2, mobil: true },
  { ime: "pocitni-1280x720", w: 1280, h: 720, dpr: 1, mobil: false }
];

/* Namenoma odsekana / drseča mesta. Kadar vrata najdejo rez prav tu, se izpiše
   kot OPOMBA in ne kot napaka — a šele potem, ko ga človek pogleda. */
const NAMENOMA = [".klapa-t", ".besedilo", ".skip"];

const SONDA = `(() => {
  const NAMENOMA = ${JSON.stringify(NAMENOMA)};
  const skrit = el => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) return true;
      if (n.getAttribute && n.getAttribute("aria-hidden") === "true") return true;
    }
    return false;
  };
  const besedni = [];
  for (const el of document.body.querySelectorAll("*")) {
    const tag = el.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "LINK" || tag === "META") continue;
    let t = "";
    for (const k of el.childNodes) if (k.nodeType === 3) t += k.nodeValue;
    if (!t.trim() && (tag === "BUTTON" || tag === "A")) t = el.textContent;
    if (!t.trim()) continue;
    if (skrit(el)) continue;
    besedni.push(el);
  }
  const zunaj = [], prerez = [], namenoma = [];
  let podZavihkom = 0;
  const prosti = el => NAMENOMA.some(s => el.matches(s));
  /* Otrok sme segati čez svojo škatlo, kadar ga prednik že seka — tako deluje
     Ken Burns (slika čez kader) in namenski okrajševalni naslov v klapi. Štejemo
     samo tisto, kar uide VEN vsakemu PRAVEMU predniku z overflow.
     Telesu (body) in korenu (html) se izmikati NE SME: onad režeta samo zato,
     ker dokument ne more drsati, kar je čista ista trditev kot ta. Izmerjeno:
     body{overflow:hidden} (zgodba.css:31) bi sicer oprostil PRAVI vsak element
     na strani in naredil trditev prazno — mutacijska vrata so to pokazala. */
  const sekaPrednik = el => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.overflowX !== "visible" || s.overflowY !== "visible") return true;
    }
    return false;
  };
  for (const el of besedni) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const vBesi = el.closest(".besedilo") !== null;
    const odmik = Math.max(-r.top, r.bottom - innerHeight, -r.left, r.right - innerWidth);
    const pot = el.className ? el.tagName.toLowerCase() + "." + String(el.className).trim().split(/\\s+/).join(".")
                             : el.tagName.toLowerCase();
    if (odmik > 1 && !sekaPrednik(el)) {
      if (prosti(el)) namenoma.push(pot + " " + el.textContent.trim().slice(0, 22) + " +" + Math.round(odmik));
      /* Panel z besedilom je namenoma daljši od zaslona in ima svoj drsnik:
         vrstica nad ali pod zavihkom ni rez, je pa številka, ki jo hočemo videti. */
      else if (vBesi) podZavihkom++;
      else zunaj.push(pot + " " + el.textContent.trim().slice(0, 22) + " +" + Math.round(odmik));
    }
    /* scrollHeight je lahko večji od clientHeight zgolj zato, ker je ink-boks
       pisave višji od vrstice — pri overflow:visible ni nič zrezanega, zato to
       šteje samo, kadar element SAM preseka. Izmerjeno: .vr-naslov client 37 /
       scroll 41 / overflow visible, tj. lažna napaka prvega poskusa. */
    const st = getComputedStyle(el);
    if (st.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1)
      (prosti(el) ? namenoma : prerez).push(pot + " sirina+" + (el.scrollWidth - el.clientWidth));
    if (!vBesi && st.overflowY !== "visible" && el.scrollHeight > el.clientHeight + 1)
      (prosti(el) ? namenoma : prerez).push(pot + " visina+" + (el.scrollHeight - el.clientHeight));
  }
  /* Ker je transport fiksno na dnu, se lahko karkoli usede NANJ in to ostane
     znotraj platu — zunanji rob tega ne vidi. Zato še prekrivanje: noben
     besedni element ne sme ležati v pasu kontrol, razen kontrol samih.
     Celozaslonski sloji (vrata, konec, besedilo) so izjema: njihov pravokotnik je
     namenoma ves zaslon, sodijo pa njihovi otroci. */
  const tp = document.getElementById("transport").getBoundingClientRect();
  const prekriva = [];
  for (const el of besedni) {
    if (el.closest(".transport") || el.closest(".besedilo") || el.closest(".vrata")) continue;
    const r = el.getBoundingClientRect();
    if (r.height >= innerHeight * 0.9) continue;
    if (r.width < 1 || r.bottom <= tp.top + 1 || r.top >= tp.bottom - 1) continue;
    prekriva.push((el.className || el.tagName) + " " + el.textContent.trim().slice(0, 18) +
      " posega " + Math.round(r.bottom - tp.top) + "px v transport");
  }
  const drsniki = [];
  for (const el of document.body.querySelectorAll("*")) {
    const o = getComputedStyle(el);
    if (!/auto|scroll/.test(o.overflowY + " " + o.overflowX)) continue;
    if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
      drsniki.push((el.className || el.tagName) + ":" + (el.scrollHeight - el.clientHeight));
  }
  return {
    docPrec: document.documentElement.scrollHeight - Math.round(innerHeight),
    sirinaPrec: document.documentElement.scrollWidth - Math.round(innerWidth),
    kader: document.getElementById("klapa-kader").textContent,
    besednih: besedni.length, podZavihkom,
    /* Panel z besedilom drsi, zato se vanj sredina sprehoditi pod prosojno
       vrstico sme — prepovedano je le, da zadnje vrstice NI mogoče dvigniti nad
       kontrole. Meri se torej dno vsebine, ko je panel zavrt do konca. */
    zadaj: (() => {
      const b = document.getElementById("besedilo");
      /* Skrit ali zrušen v ničelno višino je panel enako nedosegljiv: display:none
         ne prepise hidden atributa, zato mora propad prepoznati po meri. */
      if (b.hidden || b.getBoundingClientRect().height < 1) return null;
      const not = document.getElementById("besNotranji");
      return { dno: Math.round(not.getBoundingClientRect().bottom), vrh: Math.round(tp.top),
        ostalo: Math.round(b.scrollHeight - b.clientHeight - b.scrollTop) };
    })(),
    /* Vrata smejo na nizkem oknu drsati — prav za to so bila prej tiho zrezana.
       Dokazati je torej treba ne to, da se ne vrtijo, ampak da je zadnja vrstica
       (licenčna opomba) z dovolj zavrtja dvignjena NAD kontrole. */
    zadajVrata: (() => {
      const v = document.getElementById("vrata");
      if (v.hidden || v.getBoundingClientRect().height < 1) return null;
      const o = document.querySelector(".vr-opomba").getBoundingClientRect();
      return { dno: Math.round(o.bottom), vrh: Math.round(tp.top),
        ostalo: Math.round(v.scrollHeight - v.clientHeight - v.scrollTop) };
    })(),
    zunaj, prerez, namenoma, prekriva,
    drsniki: drsniki.filter(d => !d.startsWith("besedilo") && !d.startsWith("vrata"))
  };
})()`;

(async () => {
  const profil = `cdp-zgodba-${Date.now()}`;
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}\\${profil}`,
    "--no-first-run", "--window-size=1500,1000", "about:blank"], { stdio: "ignore" });
  let v;
  for (let i = 0; i < 40; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await wait(400); }
  }
  if (!v) throw new Error("Chrome se ni zagnal");
  const ubij = () => { try { chrome.kill(); } catch { } };
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  let n = 0; const p = new Map();
  const send = (m, pr = {}, sid) => new Promise((res, rej) => {
    const id = ++n; p.set(id, { res, rej });
    ws.send(JSON.stringify(sid ? { id, method: m, params: pr, sessionId: sid } : { id, method: m, params: pr }));
  });
  ws.addEventListener("message", e => {
    const m = JSON.parse(e.data);
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
  const tipka = async (k, code) => {
    await sess("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: 0 });
    await sess("Input.dispatchKeyEvent", { type: "keyUp", key: k, code });
  };
  /* Pisave morajo biti na mestu PRED vsakim zavrtjem do dna. Izmerjeno
     2026-10-27 z rka-drs-diagnoza.cjs: pri širini 320 px je bil ob nastavitvi
     scrollTop status document.fonts še »loading«; zamenjava pisave je skrčila
     višino vsebine z 2199 na 2177 px, že nastavljeni scrollTop pa je ostal 1 px
     nad novim dnom. Zato je bila sonda v verizi rdeča (SMRT: sirina-320/sl),
     samostojno pa zelena — vrata, ki enkrat na zagon lajejo, ne štejejo nobenega
     rezultata. Po pomiritvi je ostanek točno 0,000. */
  const CakajPisave = async () => {
    for (let i = 0; i < 60; i++) {
      if (await ev("document.fonts.status !== 'loading'")) return;
      await wait(150);
    }
    throw new Error("pisave se v 9 s niso naložile — meritev zavrtja do dna ne bi bila odločena");
  };
  /* Nastavi zavrtje in ga beri v ISTEM sinhronem bloku: branje v naslednjem
     CDP klicu bi lahko zasledilo postavitev, ki se je medtem premaknila. */
  const zavrtjiDoDna = id => ev(`(() => { const b = document.getElementById(${JSON.stringify(id)});
    b.scrollTop = b.scrollHeight;
    return { pisave: document.fonts.status,
      ostalo: Math.round(b.scrollHeight - b.clientHeight - b.scrollTop),
      ostanekFloat: b.scrollHeight - b.clientHeight - b.scrollTop }; })()`);
  await sess("Page.enable"); await sess("Runtime.enable");

  const napake = [], opombe = [], slabe = new Set();
  let vzorcev = 0;

  for (const z of ZASLONI) {
    await sess("Emulation.setDeviceMetricsOverride",
      { width: z.w, height: z.h, deviceScaleFactor: z.dpr, mobile: z.mobil });

    for (const jezik of ["sl", "en"]) {
      await sess("Page.navigate", { url: NASLOV });
      for (let i = 0; i < 120; i++) {
        if (await ev("!!document.getElementById('platno') && typeof seznam !== 'undefined' && seznam.length > 0")) break;
        await wait(120);
      }
      if (jezik === "en") { await ev("nastaviJezik('en')"); await wait(1200); }

      /* --- 1) VRATA, preden se k dotakne predvajanja --- */
      const meri = async oznaka => {
        await wait(820);                       /* REZ 0,30 + FADE 0,42 = 0,72 s */
        const a = await ev(SONDA);
        await wait(360);
        const b = await ev(SONDA);
        vzorcev++;
        const enako = JSON.stringify(a) === JSON.stringify(b);
        const slaba = !enako || b.docPrec > 0 || b.sirinaPrec > 0 ||
          b.zunaj.length || b.prerez.length || b.drsniki.length || b.prekriva.length;
        if (slaba) slabe.add(`${z.ime}/${jezik}/${oznaka}`);
        if (b.prekriva.length) napake.push(`${z.ime}/${jezik}/${oznaka}: posedanje=[${b.prekriva.join(" | ")}]`);
        if (b.zunaj.length) napake.push(`${z.ime}/${jezik}/${oznaka}: zunaj=[${b.zunaj.join(" | ")}]`);
        if (b.prerez.length) napake.push(`${z.ime}/${jezik}/${oznaka}: prerezano=[${b.prerez.join(" | ")}]`);
        if (b.docPrec > 0 || b.sirinaPrec > 0)
          napake.push(`${z.ime}/${jezik}/${oznaka}: dokument drsi doc+${b.docPrec} sirina+${b.sirinaPrec}`);
        if (b.drsniki.length) napake.push(`${z.ime}/${jezik}/${oznaka}: nepričakovan drsnik [${b.drsniki}]`);
        if (!enako) napake.push(`${z.ime}/${jezik}/${oznaka}: meritev se med ponovitvijo spremeni (sredi reza?)`);
        if (b.namenoma.length) opombe.push(`${z.ime}/${jezik}/${oznaka}: namenoma [${b.namenoma.join(" | ")}]`);
        if (slaba) console.log(`!! ${z.ime}/${jezik} ${oznaka}`);
        return b;
      };

      const prva = await meri("vrata");
      if (prva.besednih < 4) throw new Error(`${z.ime}/${jezik}: v vratih ni besedila — sonda ne meri ničesar`);
      if (!prva.zadajVrata) throw new Error(`${z.ime}/${jezik}: vrata se niso našla — trditev ni izmerjena`);
      await CakajPisave();
      const ucvVrata = await zavrtjiDoDna("vrata");
      const doDna = await meri("vrata do dna");
      if (ucvVrata.ostalo !== 0)
        throw new Error(`${z.ime}/${jezik}: vrata se v pomirjeni postavitvi niso dotaknila dna ` +
          `(ostanek ${ucvVrata.ostanekFloat.toFixed(3)} px ob samem zavrtju) — trditev ni izmerjena`);
      if (doDna.zadajVrata.ostalo !== 0)
        throw new Error(`${z.ime}/${jezik}: vrata do dna niso zavrtela (ostalo ${doDna.zadajVrata.ostalo} px) — trditev ni izmerjena`);
      console.log(`   ${z.ime}/${jezik} vrata:   ${String(prva.zadajVrata.ostalo).padStart(3)} px za zavrteti · ` +
        `dno opombe ${doDna.zadajVrata.dno} / vrh kontrol ${doDna.zadajVrata.vrh} · ` +
        `ostanek ${ucvVrata.ostanekFloat.toFixed(3)} px (pisave: ${ucvVrata.pisave})`);
      if (doDna.zadajVrata.dno > doDna.zadajVrata.vrh)
        napake.push(`${z.ime}/${jezik}/vrata: licenčna opomba ostane ${doDna.zadajVrata.dno - doDna.zadajVrata.vrh} px pod kontrolami`);

      /* --- 2) PREDVAJANJE BREZ ZVOKA, nato vsak kader posebej --- */
      await ev("document.getElementById('vBrezZvoka').click()");
      await wait(900);
      await tipka(" ", "Space");               /* ustavi: ura se ne premika med meritvijo */
      const stevilo = await ev("seznam.length");
      for (let k = 0; k < stevilo; k++) {
        const m = await meri("kader " + await ev("document.getElementById('klapa-kader').textContent"));
        if (m.kader === "konec") break;
        if (k < stevilo - 1) await tipka("ArrowRight", "ArrowRight");
      }

      /* --- 3) KONČNA PLOŠČA: zažene se do konca sama --- */
      await tipka(" ", "Space");
      let konec = false;
      for (let i = 0; i < 60; i++) {
        if (await ev("!document.getElementById('konec').hidden")) { konec = true; break; }
        await wait(300);
      }
      if (!konec) throw new Error(`${z.ime}/${jezik}: končna plošča se ni prikazala — ta trditev ni izmerjena`);
      await meri("konec");

      /* --- 4) BESEDILO (sme drsiti po višini) in VARNA CONA --- */
      await ev("odpriBesedilo()");
      await CakajPisave();
      const ucvBes = await zavrtjiDoDna("besedilo");
      const be = await meri("besedilo");
      if (!be.zadaj) throw new Error(`${z.ime}/${jezik}: panel z besedilom se ni odprl — trditev ni izmerjena`);
      if (ucvBes.ostalo !== 0)
        throw new Error(`${z.ime}/${jezik}: panel se v pomirjeni postavitvi ni dotaknil dna ` +
          `(ostanek ${ucvBes.ostanekFloat.toFixed(3)} px ob samem zavrtju) — trditev ni izmerjena`);
      if (be.zadaj.ostalo !== 0)
        throw new Error(`${z.ime}/${jezik}: panel se ni zavrtel do dna (ostalo ${be.zadaj.ostalo} px) — trditev ni izmerjena`);
      console.log(`   ${z.ime}/${jezik} besedilo: ${be.podZavihkom} vrstic je pod zavihkom, dno ${be.zadaj.dno} / vrh kontrol ${be.zadaj.vrh} · ` +
        `ostanek ${ucvBes.ostanekFloat.toFixed(3)} px (pisave: ${ucvBes.pisave})`);
      if (be.sirinaPrec > 0) napake.push(`${z.ime}/${jezik}/besedilo: panel drsi v sirino`);
      if (be.zadaj.dno > be.zadaj.vrh)
        napake.push(`${z.ime}/${jezik}/besedilo: zadnja vrstica ostane ${be.zadaj.dno - be.zadaj.vrh} px pod kontrolami`);
      await ev("zapriBesedilo()");
      await ev("preklopiVarnoCono()");
      await meri("varna cona");
      await ev("preklopiVarnoCono()");
    }
  }

  /* --- 5) IZVOZNI NAČIN: živa odzivnost ne sme premakniti predanega kadra ---
     Pokončni izvoz odpre stran v oknu 1080 x 1920, kar USTREZA ozkemu bloku v
     zgodba.css. Kadar živo varno cono zapišemo v :root, jo podeduje tudi izvoznik:
     .napisi{bottom:var(--rob-s)} bi napis dvignil za 25 px više, kot so ga predani
     masterji (izmerjeno 2026-10-25). Ciljne vrednosti stojijo ob IZVOZ zgoraj. */
  for (const i of IZVOZ) {
    await sess("Emulation.setDeviceMetricsOverride",
      { width: i.w, height: i.h, deviceScaleFactor: 1, mobile: false });
    await sess("Page.navigate", { url: i.url });
    for (let k = 0; k < 120; k++) {
      if (await ev("!!document.querySelector('.napisi') && typeof seznam !== 'undefined' && seznam.length > 0")) break;
      await wait(120);
    }
    await wait(900);
    const m = await ev(`(() => { const el = document.querySelector('.napisi');
      const n = el.getBoundingClientRect();
      return { odstop: Math.round((innerHeight - n.bottom) * 100) / 100,
        bottom: getComputedStyle(el).bottom,
        vpeto: getComputedStyle(document.documentElement).getPropertyValue('--rob-s').trim(),
        vnosno: document.documentElement.style.getPropertyValue('--rob-s'),
        transport: getComputedStyle(document.getElementById('transport')).display,
        klapa: getComputedStyle(document.getElementById('klapa')).display }; })()`);
    const narobe = [];
    if (Math.abs(m.odstop - i.rob) > 0.6)
      narobe.push(`napis leži ${m.odstop} px od dna, predana datoteka pa ${i.rob} px`);
    if (m.vnosno !== "") narobe.push(`izvozni način je dobil živo varno cono po meri (--rob-s="${m.vnosno}")`);
    if (m.transport !== "none" || m.klapa !== "none")
      narobe.push(`izvoznik vidi opremo (transport=${m.transport}, klapa=${m.klapa})`);
    vzorcev++;
    if (narobe.length) { slabe.add(`izvoz/${i.ime}`); for (const x of narobe) napake.push(`izvoz/${i.ime}: ${x}`); }
    console.log(`   izvoz/${i.ime}: napis ${m.odstop} px od dna (predano ${i.rob}) · ` +
      `uporabljen bottom "${m.bottom}" · --rob-s "${m.vpeto}" · oprema ${m.transport}/${m.klapa}${narobe.length ? "  !!" : ""}`);
  }

  /* ZGORNJI PAS nosi samo znamko. Naslov reza iz spot.json je bil tehničen
     podatek z delovne mize, na tridesetsekundnem rezu pa je celo napačno trdil
     dolžino — Robert ga je 28. 10. 2026 ukazal izbrisati. Trditev je negativna,
     zato preverja obe plati: kaj piše in da se element ni vrnil. */
  await sess("Emulation.setDeviceMetricsOverride",
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await sess("Page.navigate", { url: NASLOV });
  for (let k = 0; k < 120; k++) {
    if (await ev("!!document.querySelector('.klapa-t')")) break;
    await wait(120);
  }
  await wait(900);
  const pas = await ev(`(() => { const t = document.querySelector('.klapa-t');
    return { besedilo: t ? t.textContent.trim() : "(ni .klapa-t)",
      delo: !!document.getElementById("klapa-delo") }; })()`);
  const pasNarobe = [];
  if (pas.besedilo !== "RKA") pasNarobe.push(`zgornji pas piše "${pas.besedilo}", dovoljen je samo "RKA"`);
  if (pas.delo) pasNarobe.push("v pasu se je vrnil element #klapa-delo");
  vzorcev++;
  if (pasNarobe.length) { slabe.add("pas/znamka"); for (const x of pasNarobe) napake.push(`pas/znamka: ${x}`); }
  console.log(`   pas/znamka: "${pas.besedilo}" · #klapa-delo ${pas.delo ? "DA" : "ne"}${pasNarobe.length ? "  !!" : ""}`);

  console.log(`\n--- presoja: ${vzorcev} meritev na ${ZASLONI.length} zaslonih x 2 jezika + ${IZVOZ.length} izvoznih oknih + zgornji pas ---`);
  const poZaslonih = {};
  for (const k of slabe) { const z = k.split("/")[0]; poZaslonih[z] = (poZaslonih[z] || 0) + 1; }
  for (const z of ZASLONI) console.log(`  ${z.ime.padEnd(16)} ${String(poZaslonih[z.ime] || 0).padStart(3)} slabih meritev`);
  console.log(`  ${"izvoz".padEnd(16)} ${String(poZaslonih["izvoz"] || 0).padStart(3)} slabih meritev`);
  const videne = [...new Set(opombe)];
  for (const o of videne.slice(0, 8)) console.log("  OPOMBA: " + o);
  if (opombe.length > videne.length) console.log(`  (opomb je ${opombe.length}, prikazanih ${videne.length} različnih)`);
  const razlicne = [...new Set(napake)];
  for (const x of razlicne) console.log("  NAP: " + x);
  console.log(slabe.size
    ? `NI V REDU: ${slabe.size} od ${vzorcev} meritev slabi (${razlicne.length} različnih ugotovitev).`
    : `V REDU: vseh ${vzorcev} meritev — nič besednega ne štruri, nič ni prerezano, dokument ne drsi.`);
  ubij();
  process.exitCode = napake.length ? 1 : 0;
})().catch(e => { console.error("SMRT:", e.message); try { } catch { } process.exit(2); });
