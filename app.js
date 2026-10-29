/* River Kolpa Apartments — enozonska stran.
   Vsi podatki so resnični in prevzeti iz objavljene strani nastanitve. Kjer podatka
   ne vemo (npr. razpored ležišč na 30 b), to piše — stran ničesar ne obljublja. */

"use strict";

const PODATKI = {
  tel: "+38640858732",
  telPrikaz: "040 858 732",
  mail: "majda.pezdirc@gmail.com",
  booking: "https://www.booking.com/hotel/si/holiday-house-kolpa.sl.html",
  facebook: "https://www.facebook.com/p/RIVER-KOLPA-Apartment-Griblje-Bela-krajina-Slovenia-100063596405674/",
  ocena: { st: "10", mnenj: "8 mnenj" }
};

const IK = {
  pin:   '<svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="10" r="2.6" stroke="currentColor" stroke-width="1.7"/></svg>',
  voda:  '<svg viewBox="0 0 24 24" fill="none"><path d="M2 16c3-3 4.5 1.5 7.5-1.5S14 13 17 10s4 1.5 5-.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M2 21c3-3 4.5 1.5 7.5-1.5S14 18 17 15s4 1.5 5-.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" opacity=".55"/></svg>',
  kaplja:'<svg viewBox="0 0 24 24" fill="none"><path d="M12 3s6 6.4 6 10.2A6 6 0 0 1 6 13.2C6 9.4 12 3 12 3z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  list:  '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20c0-8 5-14 16-15 0 10-5 15-12 15-2 0-4 0-4 0z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 16c2-3 5-5 9-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  kljuc: '<svg viewBox="0 0 24 24" fill="none"><circle cx="8" cy="8" r="4.4" stroke="currentColor" stroke-width="1.7"/><path d="M11 11l9 9M17 17l2-2M14.5 14.5l2-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  telefon:'<svg viewBox="0 0 24 24" fill="none"><path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  pismo: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" stroke-width="1.7"/><path d="M4 7l8 6 8-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12.5l5 5L20 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

/* Fotografije so iz lastnega arhiva nastanitve; drugi element je njihov lasten opis. */
const F = {
  "terasa-studio":["Pokrita terasa z jedilno mizo in kotom za sprostitev","vrt"],
  "letna-kuhinja":["Letna kuhinja pod lesenim nadstreškom","vrt"],
  "pergola-vrt":["Pergola z belimi zavesami in jedilno mizo","vrt"],
  "letna-kuhinja-detajl":["Letna kuhinja s ploščo za kuho, umivalnikom in orodjem na steni","vrt"],
  "miza-pergola":["Pogled s pergole na vrt z ležalnikoma","vrt"],
  "terasa-pregled":["Pergola z dolgo mizo in staro črpalko, uta v ozadju","vrt"],
  "jacuzzi-terasa":["Vrtni kot z žarom in jacuzzijem","vrt"],
  "gugal":["Viseči kokon med bršljanom","vrt"],
  "vrt-05":["Ležalnik ob zunanji kuhinji","vrt"],
  "noter-01":["Odprt dnevni prostor z jedilnico in kuhinjo","noter"],
  "noter-02":["Kutna zofa pod lesenimi gredami","noter"],
  "noter-03":["Opremljena kuhinja","noter"],
  "hodnik-kisa":["Kurilni kot s pečjo na drva in pogledom v sobo","noter"],
  "noter-10":["Predel za sedenje z ravnim televizorjem in pogradom","noter"],
  "soba-main":["Soba s tremi posteljami","noter"],
  "soba-otroci":["Soba z dvema nadstavnima postelama","noter"],
  "soba-kisa":["Kaminski kot s pečjo na drva in jedilnico","noter"],
  "kopalnica-70":["Kopalnica z umivalnikom, zloženimi brisačami in leseno polico","noter"],
  "miza":["Pogrnjena miza pod leseno pergolo","izkus"],
  "izkus-01":["Domača pogača iz lastne peči","izkus"],
  "vrt-pregled":["Vrt s pergolo, jacuzzijem in dvema ležalnikoma","izkus"],
  "masazna-kad":["Jacuzzi z mehurčki pod visečimi cvetlicami","izkus"],
  "uta-dan":["Uta z jacuzzijem in lesenima ležalnikoma","izkus"],
  "noc":["Jacuzzi na lesenem odru ob mraku","izkus"],
  "vrt-lezniki":["Dva ležalnika pred jacuzzijem","izkus"],
  "uta-noc":["Uta zvečer, čez vrt poteka vrsta lučk","izkus"],
  "zunanjost-30b":["Hiša z nadstreškom in jacuzzijem","30b"],
  "travnik-30b":["Travnik pred hišo z nogometnimi vrati in ležalniki","30b"],
  "kopalnica-30b":["Kopalnica s tušem, umivalnikom in strojem za perilo","30b"],
  "soba-30b-a":["Spalnica z zakonsko posteljo in omaro","30b"],
  "soba-30b-b":["Spalnica z zakonsko posteljo in pobarvanim lesenim stropom","30b"],
  "soba-30b-c":["Soba z zakonsko in enojno posteljo","30b"],
  "kuhinja-30b":["Kuhinja s pečico, štedilnikom in jedilno mizo","30b"],
  "hodnik-30b":["Predprostor z omaro za obutev in ogledalom","30b"],
  "reka-01":["Reka Kolpa poleti z naravnim kopališčem","reka"],
  "reka-02":["Kopanje v Kolpi","reka"],
  "reka-03":["Brisače in senca na rečnem bregu","reka"],
  "reka-04":["Kajak po Kolpi","reka"],
  "reka-05":["Skok v reko z naravne police","reka"],
  "reka-06":["Plitvina, kjer voda seže do pasu","reka"],
  "reka-07":["Naravni vodni tobogan","reka"],
  "reka-08":["Prodnat breg s pogledom na nasprotno stran","reka"]
};
const alt = ime => F[ime][0];
const img = (ime, extra = "") =>
  `<img src="assets/${ime}.webp" alt="${alt(ime)}" loading="lazy" decoding="async" ${extra}>`;

const HISE = {
  "70": {
    id: "70", pogled: "h70", naslov: "Griblje 70", naslovFull: "Griblje 70, SI-8332 Gradac",
    map: "https://www.google.com/maps/search/?api=1&query=Griblje+70+8332+Gradac+Slovenija",
    lede: "Prenovljena hiša z dvema samostojnima apartmajema. Skupen ograjen vrt s pergolo, " +
          "letno kuhinjo in jacuzzijem; do naravnega kopališča na Kolpi je deset minut hoje.",
    fakti: [["2", "samostojni enoti"], ["7 + 5", "oseb"], ["10 min", "hoje do reke"], ["10 / 10", "8 mnenj"]],
    enoti: [["Apartma za 7 oseb — zgornji del", "7 ležišč v dveh spalnicah · dnevni del s kaminskim kotom · kopalnica · lastna terasa"],
            ["Studio za 5 oseb — spodnji del", "raztegljiv kavč in pograd · opremljena kuhinja · primerni za štiri do pet oseb"]],
    opreme: ["Brezplačen WiFi", "Brezplačno parkirišče", "Klimatska naprava", "Štedilnik na drva",
             "Popolnoma opremljena kuhinja", "Jacuzzi na vrtu", "Ograjen vrt in travnik",
             "Ljubljenčki ob predhodni najavi"],
    /* Fotografije so razdeljene po enotah tako, kot jih je potrdil lastnik:
       ZGORNJI apartma (7 oseb) = dve spalnici in kaminski kot s pečjo na drva;
       SPODNJI studio (5 oseb) = en odprt prostor z raztegljivim kavčem, pogradom
       in kuhinjo. Nobena fotografija ne sme stati v obeh blokih. */
    velika: "soba-kisa",
    smini: ["soba-main", "soba-otroci", "hodnik-kisa"],
    enotaVelika: { "Apartma za 7 oseb — zgornji del": "soba-kisa",
                   "Studio za 5 oseb — spodnji del": "noter-10" },
    enotaSmini: { "Apartma za 7 oseb — zgornji del": ["soba-main","soba-otroci","hodnik-kisa","kopalnica-70"],
                   "Studio za 5 oseb — spodnji del": ["noter-01","noter-02","noter-03","terasa-studio"] }
  },
  "30b": {
    id: "30b", pogled: "h30b", naslov: "Griblje 30 b", naslovFull: "Griblje 30 b, SI-8332 Gradac",
    map: "https://www.google.com/maps/search/?api=1&query=Griblje+30+b+8332+Gradac+Slovenija",
    lede: "Dva samostojna apartmaja v urejeni hiši. Kuhinja s pečico in štedilnikom, kopalnica " +
          "s tušem in pralnim strojem, nadstrešena terasa z jacuzzijem in travnik z nogometnimi vrati.",
    fakti: [["2", "samostojna apartmaja"], ["jacuzzi", "pod nadstreškom"], ["travnik", "z nogometnimi vrati"], ["tuš", "in pralni stroj"]],
    enoti: [["Dva samostojna apartmaja", "razpored ležišč potrdimo ob povpraševanju"]],
    opreme: ["Brezplačen WiFi", "Kuhinja s pečico in štedilnikom", "Kopalnica s tušem in pralnim strojem",
             "Jacuzzi na nadstrešeni terasi", "Ograjen travnik z nogometnimi vrati"],
    velika: "zunanjost-30b", smini: ["travnik-30b", "kuhinja-30b", "kopalnica-30b", "soba-30b-a"]
  }
};

/* Oznota je "Povpraševanje", ne "Prosti termini": prostih terminov na spletu ne
   objavljamo — to stran v isti potezi tudi pove — zato ime gumba ne sme obljubljati
   pregleda, ki ga ni. Kratko je zavestno: na 320 px je vsak znak cena gostote
   (rka-drsenje-sonda.cjs). */
const NAV = [["domov", "Domov"], ["h70", "Griblje 70"], ["h30b", "Griblje 30 b"],
             ["reka", "Reka Kolpa"], ["galerija", "Galerija"], ["termini", "Povpraševanje"]];

const PRAVILA = [
  ["Prijava in odjava", ["Prijava med 15.00 in 22.00, odjava med 9.30 in 10.00",
   "Prosimo, vnaprej sporočite predvideni čas prihoda"]],
  ["Otroci", ["Otroci vseh starosti so dobrodošli",
   "Posteljice in dodatna ležišča niso na voljo",
   "Cena je odvisna od števila oseb — navedite starost otrok"]],
  ["Ljubljenčki in kajenje", ["Ljubljenčki ob predhodni najavi, doplačilo 20 € na bivanje",
   "Kajenje v prostorih je prepovedano", "Nočni mir med 22.00 in 6.00"]],
  ["Rezervacija", ["Neposredno po telefonu ali e-pošti, brez provizije",
   "Prek Booking.com plačilo ureja Booking.com",
   "Turistična taksa Občine Črnomelj: 2,00 € na osebo na dan"]]
];

const $ = (s, r = document) => r.querySelector(s);
const stage = $("#stage"), elNav = $("#nav"), elTrail = $("#trail"), elBack = $("#back"), bg = $("#bg");

const mailto = zadeva =>
  `mailto:${PODATKI.mail}?subject=${encodeURIComponent("River Kolpa Apartments — " + zadeva)}` +
  `&body=${encodeURIComponent("Pozdravljeni,\n\nzanima me termin v Gribljah.\n\nTermin: \nŠtevilo oseb: \nTelefon: \n\nHvala!")}`;

/* ---------------- DOMOV ---------------- */
const REVIJI = [
  ["Izjemno lepo opremljena in čista počitniška hišica, ki nudi popolno zasebnost s popolnoma ograjenim vrtom.", "Avan", "Slovenija"],
  ["Zelo prijazna in topla gostiteljica, lepo stanovanje in prostorna terasa z veliko zasebnosti, zelo dobro opremljena letna kuhinja.", "Matija", "Slovenija"],
  ["Krasen apartma, Majda je super gostiteljica, okolica je prekrasna, do najbližjega kopališča se sprehodiš po prelepi, mirni poti med polji.", "Živa", "Slovenija"]
];
let revI = 0;
const mnenje = () => {
  const r = REVIJI[revI % REVIJI.length]; revI++;
  return `<figure class="mnenje"><q>${r[0]}</q><cite><b>${r[1]}</b> · ${r[2]} · 10 / 10</cite></figure>`;
};

function vDomov() {
  const karta = (foto, t, m, x, cilj) => `
    <a class="karta" href="#${cilj}" data-go="${cilj}">
      ${img(foto)}
      <span class="k-b"><span class="k-t">${t}</span><span class="k-m">${m}</span><span class="k-x">${x}</span></span>
    </a>`;
  const skupina = (h, karte) => `
    <section class="skup">
      <header class="skup-h"><h3>${h.naslov}</h3>
        <a href="#${h.pogled}" data-go="${h.pogled}">Podrobnosti ›</a></header>
      <div class="kart">${karte}</div>
    </section>`;
  const h70 = HISE["70"], h30 = HISE["30b"];
  return `
  <div class="view domov">
    <section class="hero">
      <p class="eyebrow">Griblje · Bela krajina · ob reki Kolpi</p>
      <h1 class="display">Dve hiši ob reki <em>Kolpi</em></h1>
      <p class="lede">Štirje samostojni apartmaji na dveh naslovih v Gribljah. Vsaka hiša ima
        teraso, jacuzzi in urejen vrt, do naravnega kopališča na Kolpi pa je deset minut hoje.</p>
      <div class="chips">
        <span class="chip"><b>4</b> apartmaji</span>
        <span class="chip"><b>2</b> naslovov</span>
        <span class="chip"><b>jacuzzi</b> in urejen vrt</span>
        <span class="chip"><b>${PODATKI.ocena.st}/10</b> · ${PODATKI.ocena.mnenj}</span>
      </div>
      <div class="cta">
        <a class="btn btn-solid" href="#termini" data-go="termini">Povprašaj za termin</a>
        <a class="btn btn-ghost" href="tel:${PODATKI.tel}">${PODATKI.telPrikaz}</a>
        <a class="btn btn-ghost" href="#galerija" data-go="galerija">Galerija</a>
      </div>
      <div class="host">
        <span class="host-av" aria-hidden="true">MP</span>
        <p><b>Vodi jo Majda Pezdirc.</b> Odgovorim v nekaj urah, tudi v soboto —
          rezervacija neposredno, brez provizije.</p>
      </div>
      ${mnenje()}
    </section>
    <aside class="enote" aria-label="Apartmaji v dveh hišah">
      ${skupina(h70,
        karta("soba-kisa", "Apartma za 7 oseb — zgornji del", "7 ležišč · dve spalnici · kopalnica",
              "Dve spalnici in dnevni del s kaminskim kotom ter pečjo na drva.", "h70") +
        karta("noter-10", "Studio za 5 oseb — spodnji del", "raztegljiv kavč in pograd · kuhinja",
              "Odprt prostor z raztegljivim kavčem, pogradom in opremljeno kuhinjo.", "h70"))}
      ${skupina(h30,
        karta("zunanjost-30b", "Dva apartmaja", "nadstrešena terasa z jacuzzijem",
              "Kuhinja s pečico, kopalnica s pralnim strojem, travnik z nogometnimi vrati.", "h30b"))}
    </aside>
  </div>`;
}

/* ---------------- HIŠA ---------------- */
function vHisa(kljuc) {
  const h = HISE[kljuc], druga = HISE[kljuc === "70" ? "30b" : "70"];
  /* Hiša z dvema enotama prikaže vsako enoto z lastno glavno fotografijo in
     lastnimi sličicami — sicer bi gledalec zamenjal stanovanje z drugim. */
  const enoteBlok = h.enotaSmini
    ? `<div class="enote-foto">${h.enoti.map(e => {
        const glavna = h.enotaVelika[e[0]] || h.velika;
        const male = (h.enotaSmini[e[0]] || []).map(s =>
          `<button data-foto="${s}" aria-label="${alt(s)}">${img(s)}</button>`).join("");
        return `<div class="enota-foto-blok">
          <p class="enota-foto-naslov">${e[0]}</p>
          <button class="glavna-btn" data-foto="${glavna}" aria-label="Odpri fotografijo: ${alt(glavna)}">
            <img src="assets/${glavna}.webp" alt="${alt(glavna)}" decoding="async" fetchpriority="high">
          </button>
          <div class="smini">${male}</div>
        </div>`;
      }).join("")}</div>`
    : `<section class="gal-loc">
         <button class="glavna-btn" data-foto="${h.velika}" aria-label="Odpri fotografijo: ${alt(h.velika)}">
           <img src="assets/${h.velika}.webp" alt="${alt(h.velika)}" decoding="async" fetchpriority="high">
         </button>
         <div class="smini">
           ${h.smini.map(s => `<button data-foto="${s}" aria-label="${alt(s)}">${img(s)}</button>`).join("")}
         </div>
       </section>`;
  return `
  <div class="view lok">
    ${enoteBlok}
    <section class="lok-info">
      <p class="eyebrow">Nastanitev · Griblje, Bela krajina</p>
      <h2 class="h2">${h.naslov}</h2>
      <p class="naslov">${IK.pin}<span>${h.naslovFull}</span>
        <a class="btn btn-ghost majhen" href="${h.map}" target="_blank" rel="noopener noreferrer">Zemljevid</a></p>
      <p class="lede">${h.lede}</p>
      <div class="fakti">${h.fakti.map(f => `<div class="fakt"><b>${f[0]}</b><span>${f[1]}</span></div>`).join("")}</div>
      <div class="enote-info">${h.enoti.map(e => `<div class="enota"><b>${e[0]}</b><span>${e[1]}</span></div>`).join("")}</div>
      <ul class="opombe">${h.opreme.map(o => `<li>${IK.check}<span>${o}</span></li>`).join("")}</ul>
      <div class="cta">
        <a class="btn btn-solid" href="${mailto("povpraševanje — " + h.naslov)}">Vprašaj za ${h.naslov}</a>
        <a class="btn btn-ghost" href="#${druga.pogled}" data-go="${druga.pogled}">Druga hiša: ${druga.naslov}</a>
      </div>
    </section>
  </div>`;
}

/* ---------------- REKA ---------------- */
function vReka() {
  const tocke = [
    ["voda", "Naravno kopališče", "Deset minut hoje od Gribljah 70 — plitva, topla in počasi tekoča reka s prodnatim bregom."],
    ["kaplja", "Naravni vodni tobogan", "Kolpa tu teče po gladki skalni polici, po kateri se spustite po hrbtu."],
    ["list", "Kajak in sprehod ob bregu", "Na tem delu je reka mirna in primerna za začetnike, ob njej pa vodi ravninska pot med polji."],
    ["pin", "Javno in brezplačno", "Do kopališča pelje pešpot, vstopnine ni. Parkirišče je pri hiši."]
  ];
  return `
  <div class="view reka">
    <button class="stek" data-foto="reka-07" data-list="reka" aria-label="Odpri fotografije reke Kolpe">
      <img src="assets/reka-07.webp" alt="${alt("reka-07")}" decoding="async" fetchpriority="high">
      <figcaption>${alt("reka-07")} — Kolpa v Gribljah</figcaption>
    </button>
    <section class="lok-info">
      <p class="eyebrow">Reka Kolpa</p>
      <h2 class="h2">Reka, ki je <em>vaš</em> vrt</h2>
      <p class="lede">Do naravnega kopališča se od hiše number 70 sprehodite po mirni poti
        med polji — deset minut, brez avtomobila.</p>
      <div class="reka-list">
        ${tocke.map(t => `<div class="rl"><span class="ico">${IK[t[0]]}</span>
          <span class="rl-b"><b>${t[1]}</b><span>${t[2]}</span></span></div>`).join("")}
      </div>
      <div class="cta">
        <a class="btn btn-ghost" href="#galerija" data-go="galerija" data-filter="reka">Vse fotografije reke</a>
        <a class="btn btn-solid" href="#termini" data-go="termini">Povpraševanje</a>
      </div>
    </section>
  </div>`;
}

/* ---------------- GALERIJA ---------------- */
const SKUPINE = [["vse", "Vse"], ["vrt", "Vrt in jacuzzi"], ["noter", "Notranjost"],
                 ["izkus", "Vrt in miza"], ["reka", "Reka Kolpa"], ["30b", "Griblje 30 b"]];
let trenutnaSkupina = "vse";
const galerijaSeznam = sk => Object.keys(F).filter(k => sk === "vse" || F[k][1] === sk);

function vGalerija() {
  return `
  <div class="view gal">
    <div class="filtri" role="group" aria-label="Skupine fotografij">
      ${SKUPINE.map(s => `<button class="filter" data-skup="${s[0]}"
        aria-pressed="${s[0] === trenutnaSkupina}">${s[1]}</button>`).join("")}
    </div>
    <div class="mreza" id="mreza"></div>
  </div>`;
}
let mrezaSeznam = [];
const RAZMIK = 9, MIN_V = 76, MIN_S = 62;
function napolniMrezo() {
  const mreza = $("#mreza"); if (!mreza) return;
  const seznam = galerijaSeznam(trenutnaSkupina);
  mrezaSeznam = seznam;
  const w = mreza.clientWidth || 900, h = mreza.clientHeight || 500;
  const dim = (c, r) => [(w - (c - 1) * RAZMIK) / c, (h - (r - 1) * RAZMIK) / r];
  const napaka = (cw, ch) => Math.abs(Math.log((cw / ch) / 1.4));
  /* 1. Rad bi pokazal vse fotografije: toliko stolpcev in vrstic, kot jih gre,
        dokler je sličica še čitljiva (vsaj MIN_V px visoka in MIN_S px široka). */
  let best = null;
  for (let c = 2; c <= 9; c++) {
    const r = Math.ceil(seznam.length / c);
    const [cw, ch] = dim(c, r);
    if (ch < MIN_V || cw < MIN_S) continue;
    const t = napaka(cw, ch) + ((c * r - seznam.length) / (c * r)) * 0.9;
    if (!best || t < best.t) best = { c, r, t, prek: 0 };
  }
  /* 2. Na majhnih zaslonih se vse ne da ob čitljivi sličici. Takrat mrežo omejimo,
        zadnja celica postane gumb "+N", svetlobno okno pa še vedno prelistava VSE. */
  if (!best) {
    const moznosti = [];
    for (let c = 2; c <= 9; c++) {
      const r = Math.floor((h + RAZMIK) / (MIN_V + RAZMIK));
      const [cw, ch] = dim(c, r);
      if (r < 1 || cw < MIN_S || c * r - 1 < 1) continue;
      moznosti.push({ c, r, prek: seznam.length - (c * r - 1), napaka: napaka(cw, ch) });
    }
    moznosti.sort((a, b) => (b.c * b.r) - (a.c * a.r) || a.napaka - b.napaka);
    if (moznosti.length) best = moznosti[0];
    else best = { c: 2, r: 1, prek: Math.max(0, seznam.length - 2) };
  }
  const prikazani = best.prek > 0 ? seznam.slice(0, best.c * best.r - 1) : seznam;
  mreza.style.gap = RAZMIK + "px";
  mreza.style.gridTemplateColumns = `repeat(${best.c},1fr)`;
  mreza.style.gridTemplateRows = `repeat(${best.r},1fr)`;
  mreza.innerHTML = prikazani.map((ime, i) => `
    <button data-foto="${ime}" data-i="${i}" aria-label="${alt(ime)}">
      ${img(ime)}<figcaption>${alt(ime)}</figcaption>
    </button>`).join("") +
    (best.prek > 0 ? `
    <button class="vec" data-vec aria-label="Odpri vseh ${seznam.length} fotografij">
      <span>+${best.prek}</span><small>še fotografij</small></button>` : "");
}

/* ---------------- PROSTI TERMINI ---------------- */
function vTermini() {
  return `
  <div class="view term">
    <section class="lok-info">
      <p class="eyebrow">Povpraševanje</p>
      <h2 class="h2">Vprašajte za <em>termin</em></h2>
      <p class="lede">Terminov na tej strani ne objavljamo.
        Napišite ali pokličite — odgovorim v nekaj urah, tudi v soboto. Na Bookingu je
        objavljen samo Griblje 70, zato je Griblje 30 b mogoče rezervirati le neposredno.</p>
      <div class="stik">
        <a class="stik-a" href="tel:${PODATKI.tel}"><span class="ico">${IK.telefon}</span>
          <span class="stik-b"><i>Telefon</i><b>${PODATKI.telPrikaz}</b></span></a>
        <a class="stik-a" href="${mailto("povpraševanje po terminu")}"><span class="ico">${IK.pismo}</span>
          <span class="stik-b"><i>E-pošta</i><b>${PODATKI.mail}</b></span></a>
        <a class="stik-a" href="${PODATKI.booking}" target="_blank" rel="noopener noreferrer"><span class="ico">${IK.kljuc}</span>
          <span class="stik-b"><i>Ali rezervirajte na Bookingu</i><b>Griblje 70 · apartma in studio</b></span></a>
      </div>
      <div class="cta">
        <a class="btn btn-ghost" href="${mailto("povpraševanje — Griblje 70")}">Griblje 70 · 7 in 5 oseb</a>
        <a class="btn btn-ghost" href="${mailto("povpraševanje — Griblje 30 b")}">Griblje 30 b · dva apartmaja</a>
      </div>
    </section>
    <section class="pravila" aria-label="Hišni red in pogoji">
      ${PRAVILA.map(p => `<div><h3>${p[0]}</h3><ul>${
        p[1].map(x => `<li><span>${x}</span></li>`).join("")}</ul></div>`).join("")}
    </section>
  </div>`;
}

/* ---------------- USMERJEVALNIK ---------------- */
const POGLEDI = {
  domov:    { label: "Domov", render: vDomov, ozadje: "video" },
  h70:      { label: "Griblje 70", render: () => vHisa("70"), ozadje: "slika" },
  h30b:     { label: "Griblje 30 b", render: () => vHisa("30b"), ozadje: "slika" },
  reka:     { label: "Reka Kolpa", render: vReka, ozadje: "video" },
  galerija: { label: "Galerija", render: vGalerija, ozadje: "mir" },
  termini:  { label: "Povpraševanje", render: vTermini, ozadje: "mir" }
};

function oznaciNav(id) {
  elNav.innerHTML = NAV.map(([n, l]) =>
    `<a href="#${n}" data-go="${n}"${n === id ? ' aria-current="page"' : ""}>${l}</a>`).join("")
    // Film je ločena stran, ne pogled — zato pravi href in ne data-go.
    + `<a class="nav-film" href="zgodba.html">Film</a>`;
  elTrail.innerHTML = id === "domov"
    ? `<b>River Kolpa Apartments</b> · Griblje pri Gradcu · Bela krajina`
    : `Domov <b>› ${POGLEDI[id].label}</b>`;
  elBack.hidden = id === "domov";
}

/* Lestvica se konča tam, kjer se zgrabi še samo zrak med bloki: --g krmari izključno
   razmike (nobena pravila velikosti pisave ga ne uporabljajo), zato spodnja koraka
   ne moreta utihti besedila — lahko pa sta pretesna. 320 px je najmanjši realen
   telefon; tam stari dno .58 ni zmanjkalo prostora, ampak lestvica. */
const GOSTOTE = [1, .90, .82, .74, .66, .58, .50, .42];
function prilepi() {
  const koren = document.documentElement, pogled = stage.firstElementChild;
  /* Vstopni premik zamakne pogled za 14 px navzdol; scrollHeight to šteje kot
     presek, zato bi lestvica vedno padla na dno. Med meritvijo animacijo
     postavimo na končni okvir in jo nato vrnemo na točko, kjer je bila —
     uporabnik vidi cel vstop, meritev pa ostane brez zamika. */
  const tek = pogled ? pogled.getAnimations() : [];
  const zamik = tek.map(a => {
    const stanje = a.playState;
    const cas = Number.isFinite(a.currentTime) ? a.currentTime : null;
    try { a.finish(); } catch { a.cancel(); }
    return [a, cas, stanje];
  });
  const sePrilega = () => {
    if (stage.scrollHeight > stage.clientHeight + 1) return false;
    if (document.body.scrollWidth > innerWidth + 1) return false;
    /* scrollHeight ne zadostuje: mreža z fiksnimi vrsticami lahko zadnji blok
       potisne izven stolpca, ta pa ostane zunaj merjenja. Zato preverimo
       pravokotnik vsakega predmeta v pogledu. */
    const meje = stage.getBoundingClientRect();
    for (const el of stage.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 && r.height < 2) continue;
      if (r.top < meje.top - 1 || r.bottom > meje.bottom + 1 ||
          r.left < meje.left - 1 || r.right > meje.right + 1) return false;
    }
    return true;
  };
  let izbrana = GOSTOTE[GOSTOTE.length - 1];
  /* Lestvica ima dve dimenziji: najprej pade gostost, šele nato podrobnost.
     Olajšava se sprosti takrat, ko jo oder zares potrebuje — ne ob neki
     poljubni širini medija. Vrstni red padajočih vsebin je v slojih. */
  const OLJASAVE = ["0", "a", "b", "c"];
  let stopnja = OLJASAVE[OLJASAVE.length - 1], prilega = false;
  for (const olajsava of OLJASAVE) {
    koren.dataset.olajsave = olajsava;
    for (const g of GOSTOTE) {
      koren.style.setProperty("--g", g);
      if (sePrilega()) { izbrana = g; stopnja = olajsava; prilega = true; break; }
    }
    if (prilega) break;
  }
  koren.style.setProperty("--g", izbrana);
  /* Oder ne drsi nikoli: .view ima clip, zato o prileganju ne povečevamo
     vsebnika, ampak merimo, kaj ostane zunaj. */
  const meje = stage.getBoundingClientRect();
  const izven = [...stage.querySelectorAll("*")].filter(o => {
    const r = o.getBoundingClientRect();
    return (r.width >= 2 || r.height >= 2) &&
      (r.top < meje.top - 1 || r.bottom > meje.bottom + 1 ||
       r.left < meje.left - 1 || r.right > meje.right + 1);
  }).length;
  /* Končni premik se vidi, meritev ga ne sme vsebovati: animacijo vrnemo na
     njeno mesto in jo predvajamo naprej, samo če je že prej tekla. */
  for (const [a, cas, stanje] of zamik) {
    if (cas === null) continue;
    try {
      a.currentTime = cas;
      if (stanje === "running" || stanje === "pending") a.play();
    } catch { /* animacija je med tem že zaključena ali preklicana */ }
  }
  window.__gostota = { g: izbrana, izven, olajsave: stopnja,
    prestop: document.body.scrollWidth - Math.round(innerWidth),
    zaslona: `${innerWidth}x${innerHeight}` };
  return izbrana;
}

let trenutni = "domov";
function prikazi(id, zgodovina = true) {
  if (!POGLEDI[id]) id = "domov";
  trenutni = id;
  document.body.dataset.bg = POGLEDI[id].ozadje;
  stage.innerHTML = POGLEDI[id].render();
  document.title = id === "domov"
    ? "River Kolpa Apartments — dve hiši ob reki Kolpi, Griblje, Bela krajina"
    : `${POGLEDI[id].label} — River Kolpa Apartments`;
  oznaciNav(id);
  if (id === "galerija") napolniMrezo();
  ozadjeUpravljanje();
  prilepi();
  /* Odločitev o gostoti velja samo z dokončnimi metriki. Slike se razpletejo
     šele za prilepi(), spletna pisava pa zamenja rezervno še pozneje — tedaj
     vrstica pridobi piksel in oder znova raste. Odločitev ponovimo, ko sta oba
     gotova: prvi obisk na hladnem brskalniku je prav tisti, ki meri z rezervno
     pisavo, in brez ponovitve bi mu ostal piksel drsenja. */
  const noveSlike = [...stage.querySelectorAll("img")];
  const cakanje = [Promise.all(noveSlike.map(i => i.decode().catch(() => {})))];
  if (document.fonts && document.fonts.ready) cakanje.push(document.fonts.ready);
  Promise.all(cakanje).then(() => { if (trenutni === id) prilepi(); });
  if (zgodovina && location.hash !== "#" + id) history.pushState(null, "", "#" + id);
}

const zmanjsajGibanje = matchMedia("(prefers-reduced-motion: reduce)");

/* Prava zanka reke je njun lastni posnetek (Camping Pezdirc Griblje — river Kolpa).
   Vgrajen je, ne kopiran: vir in pravice ostaneta na YouTube-u. Lokalni mp4 ostane
   takojšen poster in hkrati rezerva — če player javi napako, se slika ne sesuje. */
const YT_ID = "pvADKrdbtD0";
const ytPlast = $("#bg-yt");
/* Izmerjeno: YouTube na hladnem profilu tečeno steče okoli 6 s. Rok je zato 9 s,
   saj prej ni mogoče ločiti res blokiranega YouTubea od počasnega. Hitrejšo pot
   blokiranega obiskovalca nosi onerror, ki sproži v goodnjih, ne ta rok. */
const YT_ROK = 9000;
let ytVtek = false;
let ytManjka = false;
let ytZiveo = false;
let ytRok = null;
function ytPrikazi() {
  ytZiveo = true;
  if (ytRok !== null) { clearTimeout(ytRok); ytRok = null; }
  /* Posnetek, ki ga je rok že vzel iz predpomnilnika, ne sme več teči za plastjo,
     ki ga nihče ne vidi. */
  bg.pause();
  ytPlast.classList.add("nalozen");
  ytPlast.inert = true;
  document.body.classList.add("yt");
}
/* Lokalni mp4 je rezerva, ne sočasna plast. Eager play() je zagnal prenos celotnega
   posnetka (1 MB) za kader, ki ga je YouTube plast takoj prekrila. Zdaj se lokalni
   posnetek prenese šele, kadar YouTube res ne steče: bodisi player javi napako,
   bodisi se v roku YT_ROK ne oglasi — to se zgodi, ko blokada prireže kar skripto
   ali povezavo, ne pa celega predmeta. */
function ytNiUspel() {
  if (ytZiveo) return;
  if (ytRok !== null) { clearTimeout(ytRok); ytRok = null; }
  ytManjka = true;
  ozadjeUpravljanje();
}
function zazeniYouTube() {
  if (ytVtek || zmanjsajGibanje.matches || !ytPlast) return;
  ytVtek = true;
  window.onYouTubeIframeAPIReady = () => {
    new window.YT.Player("yt-zanka", {
      videoId: YT_ID,
      host: "https://www.youtube-nocookie.com",
      playerVars: { autoplay: 1, mute: 1, loop: 1, playlist: YT_ID, controls: 0,
        modestbranding: 1, rel: 0, playsinline: 1, disablekb: 1, fs: 0, iv_load_policy: 3 },
      events: {
        onReady: (e) => { e.target.mute(); e.target.playVideo(); },
        onStateChange: (e) => { if (e.data === window.YT.PlayerState.PLAYING) ytPrikazi(); },
        onError: () => { ytPlast.classList.add("napaka"); ytNiUspel(); }
      }
    });
  };
  /* Pustimo, da najprej stečejo pisave in vstopna animacija. */
  setTimeout(() => {
    const skripta = document.createElement("script");
    skripta.src = "https://www.youtube.com/iframe_api";
    skripta.async = true;
    skripta.onerror = ytNiUspel;
    document.head.appendChild(skripta);
  }, 500);
  /* IFrame API ne javi ničesar, če povezava do YouTubea nikoli ne odzivi — rok
     teče od trenutka odločitve, vključno s 500 ms odmika za pisave. Ko YouTube
     enkrat steče, se rok prekliče; sicer bi občasno vžgal rezervo za kader, ki
     je takrat že prekrit. */
  ytRok = setTimeout(ytNiUspel, YT_ROK);
}

function ozadjeUpravljanje() {
  const nacin = document.body.dataset.bg;
  bg.classList.toggle("on", nacin !== "mir");
  /* Zanka teče le na domov in ob reki; hiše ostanejo na mirnem kadru.
     Če obiskovalec zahteva manj gibanja, je kadru tudi poster. */
  if (nacin !== "video" || zmanjsajGibanje.matches) {
    bg.pause();
    return;
  }
  /* Lokalni posnetek se zavrti šele, ko je gotovo, da YouTube giba ne bo pokazal.
     Dokler samo poskuša steči, je na ogled poster — ista slika, brez prenosa. */
  const youtube = document.body.classList.contains("yt");
  if (!youtube && (ytManjka || !ytPlast)) bg.play().catch(() => {});
  else if (youtube) bg.pause();
  zazeniYouTube();
}

/* ---------------- SVETLOBNA OKNA ---------------- */
const lb = $("#lightbox"), lbImg = $("#lbImg"), lbCap = $("#lbCap");
let lbSeznam = [], lbI = 0;
function odpriFoto(seznam, i) {
  if (!seznam.length) return;
  lbSeznam = seznam; lbI = Math.max(0, i);
  postaviFoto(); lb.showModal();
}
function postaviFoto() {
  const ime = lbSeznam[lbI];
  lbImg.src = `assets/${ime}.webp`; lbImg.alt = alt(ime);
  lbCap.textContent = `${alt(ime)} · ${lbI + 1} / ${lbSeznam.length}`;
}
const premik = n => { lbI = (lbI + n + lbSeznam.length) % lbSeznam.length; postaviFoto(); };
$("#lbX").onclick = () => lb.close();
$("#lbPrev").onclick = () => premik(-1);
$("#lbNext").onclick = () => premik(1);
lb.addEventListener("click", e => { if (e.target === lb) lb.close(); });
document.addEventListener("keydown", e => {
  if (!lb.open) return;
  if (e.key === "ArrowRight") premik(1);
  if (e.key === "ArrowLeft") premik(-1);
});

/* ---------------- DOGODKI ---------------- */
document.addEventListener("click", e => {
  const filter = e.target.closest("[data-skup]");
  if (filter) {
    trenutnaSkupina = filter.dataset.skup;
    document.querySelectorAll(".filter").forEach(b =>
      b.setAttribute("aria-pressed", String(b.dataset.skup === trenutnaSkupina)));
    napolniMrezo(); prilepi(); return;
  }
  if (e.target.closest("[data-vec]")) { odpriFoto(mrezaSeznam, 0); return; }
  const foto = e.target.closest("[data-foto]");
  if (foto) {
    const zajeta = foto.closest(".mreza") || foto.closest(".gal-loc") || foto.closest(".enota-foto-blok");
    if (zajeta?.id === "mreza") {
      /* Seznam vzamemo iz celotne skupine, ne iz DOM: na majhnih zaslonih mreža
         pokaže le del fotografij, v oknu pa morajo biti vse na voljo. */
      odpriFoto(mrezaSeznam, mrezaSeznam.indexOf(foto.dataset.foto));
    } else if (zajeta) {
      /* Pri dveh enotah v hiši bralec brska le znotraj svojega stanovanja:
         seznam vzamemo iz istega bloka, ne iz celotne strani. */
      const s = [...zajeta.querySelectorAll("[data-foto]")].map(b => b.dataset.foto);
      odpriFoto(s, s.indexOf(foto.dataset.foto));
    } else if (foto.dataset.list) {
      const s = galerijaSeznam(foto.dataset.list);
      odpriFoto(s, s.indexOf(foto.dataset.foto));
    } else odpriFoto([foto.dataset.foto], 0);
    return;
  }
  const go = e.target.closest("[data-go]");
  if (!go) return;
  e.preventDefault();
  if (go.dataset.filter) trenutnaSkupina = go.dataset.filter;
  prikazi(go.dataset.go);
});

elBack.addEventListener("click", () => { if (history.length > 1) history.back(); else prikazi("domov"); });
addEventListener("popstate", () => prikazi((location.hash || "#domov").slice(1), false));
let rt = 0;
addEventListener("resize", () => {
  clearTimeout(rt);
  rt = setTimeout(() => { if (trenutni === "galerija") napolniMrezo(); prilepi(); }, 140);
});

prikazi((location.hash || "#domov").slice(1), false);

/* Gostost izberemo šele, ko so pisave naložene — sicer meritev z rezervnimi pisavami
   izbere premajhno stopnjo in se vidi poskok. Varnostna ura: če pisave nikoli ne
   dokončajo, se stran prikaže z zadnjo izmerjeno gostostjo. */
const prikaziSe = () => { prilepi(); document.documentElement.classList.add("pripravljen"); };
Promise.race([
  document.fonts ? document.fonts.ready : Promise.resolve(),
  new Promise(r => setTimeout(r, 1200))
]).then(() => requestAnimationFrame(prikaziSe));
addEventListener("load", prikaziSe);
