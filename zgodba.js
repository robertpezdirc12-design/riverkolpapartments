/* Predvajalnik spota. Vir resnice je spot.json; položaji vrstic pridejo iz
   namera-<enota>-<jezik>.json, ki ga je napisalo isto merjenje, iz katerega je
   nastal zvočni mojster — zato besedilo in zvok ne moreta razitati.

   Ura: kadar zvok teče, jo narekuje avdiotrack (sicer bi se plastici razšli).
   Kadar zvoka ni, teče lastni nalog iz performance.now(). */
"use strict";

const REZ_TRAJANJE = 0.30;      // dolzina vodnega reza v sekundah
const FADE = 0.42;              // zabris in zabris podnapisa, v sekundah
const $ = s => document.querySelector(s);

/* Živost gibanja. Količine spodaj so odločitev, ne izmerjena lastnost posnetka:
   preveč ublažitve ali vidna roka bi delovala kot napaka, ne kot kamera. */
const UBLAG = 0.45;             // količna ublažitev: hoja se začne in konča počasneje
const ROKA_X = 0.28, ROKA_Y = 0.20;   // amplituda mirne roke, v % širine sloja
const PI_AMPL = 0.016;          // približaj ob rezu, v deležu povečave
const PI_TRAJ = 0.9375;         // dva utripa pri 128 BPM — odmev, nato se kader umiri
const PI_UPOC = 3.2;            // eksponentni upad odmeva čez PI_TRAJ

/** Cikloidna ublažitev: e(0)=0 in e(1)=1, odvod e'(t)=1-UBLAG·cos(2πt) pa je pri
    UBLAG<1 vedno pozitiven, zato kader nikoli ne gre nazaj. Konstantna hitrost
    je bila tisto, kar je fotografijo bralo kot slajd. */
function ublaz(t) {
  return t - (UBLAG / (2 * Math.PI)) * Math.sin(2 * Math.PI * t);
}

/** Mirna roka: dve komponenti pod 1 Hz, ki se nikoli ne ujemata v fazi, s fazo iz
    imena kadra, da je vsak izvoz iste datoteke enak. Ura teče absolutno, da se
    tresljaj ne začne na novo ob vsakem kadru. Amplituda je majhna namerno:
    tresljaj, ki ga opaziš, je premočan. */
function roka(id, cas) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const f1 = ((h >>> 0) % 628) / 100, f2 = ((h >>> 8) % 471) / 100;
  return [ROKA_X * Math.sin(f1 + 2 * Math.PI * 0.23 * cas) + ROKA_X * 0.5 * Math.sin(f2 + 2 * Math.PI * 0.61 * cas),
          ROKA_Y * Math.sin(f2 + 2 * Math.PI * 0.19 * cas) + ROKA_Y * 0.5 * Math.sin(f1 + 2 * Math.PI * 0.53 * cas)];
}

/* Smer prehoda sledi smeri, v katero potuje prihajajoči kader, da oko nadaljuje
    pot in ne začne vsakič znova od leve. pull in panL se odpirata z desne. */
const SMER_PREHODA = { push: 1, panR: 1, pull: -1, panL: -1 };
const skriti = v => (v.smer < 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)");

const DRZAVA = {
  platno: $("#platno"), napisi: $("#napisi"), reznica: $("#reznica"), crni: $("#crni"),
  varnost: $("#varnost"),
  kader: $("#klapa-kader"), stevec: $("#klapa-stevec"), pog: $("#klapa-pog"),
  ura: $("#klapa-ura"),
  trak: $("#trak"), zapolni: $("#trakZapolni"), kaza: $("#trakKaza"), zobi: $("#trakZobi"),
  transport: $("#transport"),
  cas: $("#tpCas"),
  gumbUstavi: $("#gumbUstavi"), gumbNazaj: $("#gumbNazaj"), gumbNaprej: $("#gumbNaprej"),
  gumb60: $("#gumb60"), gumb30: $("#gumb30"), gumbJezik: $("#gumbJezik"), gumbZvuk: $("#gumbZvuk"),
  gumbTekst: $("#gumbTekst"), gumbVarnost: $("#gumbVarnost"), gumbCelost: $("#gumbCelost"),
  vrata: $("#vrata"), vPredvajaj: $("#vPredvajaj"), vBrezZvoka: $("#vBrezZvoka"),
  v60: $("#v60"), v30: $("#v30"), vSl: $("#vSl"), vEn: $("#vEn"), vLede: $(".vr-lede"),
  besedilo: $("#besedilo"), besNotranji: $("#besNotranji"), gumbNazajFilm: $("#gumbNazajFilm"),
  konec: $("#konec"), kOne: $("#kOne"), kTel: $("#kTel"), kPonovi: $("#kPonovi"),
  kBesedilo: $("#kBesedilo"),
  zvok: $("#zvok"), podnapisSled: $("#podnapisSled"), podnapis: $("#podnapis"),
  gumbPodnapisi: $("#gumbPodnapisi")
};

let SPOT = null;                  // spot.json
const stanje = { rez: "60", jezik: "sl", zvuk: true, podnapisi: false, razmerje: "16x9" };
let seznam = [];                  // izracunani kadri aktivne enote
let cas = 0;                      // trenutna ura spota v sekundah
let predvaja = false;
let zadnjiTik = 0;
let zvokElement = null;
let zvocnaNapaka = false;
let cueji = [];                   // sledi pripovedi iz .vtt
let podnapisiManjkajo = false;
const BLADENJE = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- pomozne ---------------- */
const STEV = (k, m = 2) => String(Math.floor(k)).padStart(m, "0");
const sekunde = s => STEV(s / 60) + ":" + STEV(s % 60);
function videokadar(s, sricje) {
  return STEV(s / 3600) + ":" + STEV((s / 60) % 60) + ":" + STEV(s % 60) +
         ":" + STEV((s % 1) * sricje);
}
const najdiKader = id => SPOT.kadri.find(k => k.id === id);
const poglavje = id => (SPOT.poglavja.find(p => p.id === id) || {}).naslov || id;

/* Izgovorjena vrstica je naslov kadra: ena sama plast besedila, ki soci z usti.
   Prednost ima razlicica konkretnega reza (govorSl60 / govorEn30 ...), ker je
   tista tudi tista, ki jo zvok posname — sicer napis in glas razideta. */
function napisKadra(kader) {
  const kratica = stanje.jezik === "sl" ? "Sl" : "En";
  const poenotenih = SPOT.rezi[stanje.rez]["govor" + kratica + stanje.rez] || {};
  return poenotenih[kader.id] || kader["govor" + kratica] || kader.beso || "";
}

/* ---------------- ZGRADNJA ---------------- */
/* Neizgovorjeni napisi (naslovec, podnaslov, oznake) so jezikovno slepi: glas
   jih ne izgovori, zato ga ne morejo razkriti. Razlicica z nastavko "En" velja
   samo za angleški posnetek; brez nje izpis pade na slovenski izvirnik, kar je
   prav za kraj, naslov in blagovno ime — tisto, kar se ne prevaja. */
function jezikovno(kader, polje) {
  if (stanje.jezik === "en" && kader[polje + "En"] !== undefined) return kader[polje + "En"];
  return kader[polje];
}

/* Podnaslov je dopolnilo kratki izgovorjeni vrstici. Kjer ga enota že izgovori
   v celoti ("Vsaka hiša svojo teraso in vrt."), ga ta enota ne ponovi. */
function pod(kader) {
  if (kader.podRez && kader.podRez !== stanje.rez) return undefined;
  return jezikovno(kader, "pod");
}

function zgradi() {
  const rez = SPOT.rezi[stanje.rez];
  let tekoce = 0;
  seznam = rez.niz.map(([id, okno]) => {
    const k = najdiKader(id);
    const v = { id, kader: k, zacetek: tekoce, okno, konec: tekoce + okno,
                napis: napisKadra(k), vrstica: null };
    tekoce += okno;
    return v;
  });
  if (Math.abs(tekoce - rez.dolzina) > 0.01) {
    napisiNapako(`Casovni list :${stanje.rez} ni konformiran — vsota oken je ` +
                 `${tekoce.toFixed(2)} s, enota pa ${rez.dolzina} s.`);
  }

  DRZAVA.platno.innerHTML = "";
  DRZAVA.napisi.innerHTML = "";
  DRZAVA.zobi.innerHTML = "";

  seznam.forEach((v, i) => {
    const k = v.kader;
    const sloj = document.createElement("div");
    sloj.className = "kader" + (k.sidro === "spodaj-desno" ? " sid-desno"
                   : k.sidro === "sredini" ? " sid-sredini" : "");
    if (k.vrsta === "zakljucek") sloj.classList.add("zakljucek");
    sloj.innerHTML = k.vrsta === "video"
      ? `<div class="k-v"><video src="${k.pot}" poster="${k.poster || ""}" muted loop autoplay
           playsinline preload="auto" disablepictureinpicture></video></div>`
      : k.vrsta === "zakljucek"
        ? `<div class="k-konec">
             <p class="k-one-t">${jezikovno(k, "eb") || ""}</p>
             <p class="k-one-b">${k.beso || ""}</p>
             <p class="k-one-govor">${v.napis}</p>
             <p class="k-one-p">${pod(k) || ""}</p>
             <ul>${(jezikovno(k, "znacke") || []).map(z => `<li>${z}</li>`).join("")}</ul>
           </div>`
        : `<div class="k-v"><img src="${k.pot}" alt="" decoding="async"></div>`;
    DRZAVA.platno.appendChild(sloj);
    /* Pokoncni pas ima za seboj zabarvano in zamegljeno nadaljevanje iste
       slike. Vir mora potovati z kadrom: pot je samo v casovnem listu, CSS je
       ne more ugibati. */
    const nastavek = k.vrsta === "slika" ? k.pot
                   : k.vrsta === "video" ? (k.poster || "") : "";
    if (nastavek) sloj.style.setProperty("--k-slika", `url("${nastavek}")`);
    v.el = sloj;
    v.gib = sloj.querySelector(".k-v");
    v.smer = SMER_PREHODA[k.gib] || 1;

    if (k.vrsta === "zakljucek") { v.napisEl = null; return; }
    const n = document.createElement("div");
    n.className = "napis" + (k.sidro === "spodaj-desno" ? " sid-desno"
                 : k.sidro === "sredini" ? " sid-sredini" : "");
    /* Podnaslov je druga polovica stavka, ki ga rez prepolovi: k02 prinese
       "Ten minutes on foot,", jego pod pa "to the natural bathing spot on the
       Kolpa". Kadar enota izgovori cel stavek, pod pade — odloci pod(). */
    const eba = jezikovno(k, "eb"), ppod = pod(k), zn = jezikovno(k, "znacke");
    n.innerHTML =
      (eba ? `<p class="n-eyebrow">${eba}</p>` : "") +
      `<p class="n-naslov">${v.napis}</p>` +
      (ppod ? `<p class="n-pod">${ppod}</p>` : "") +
      (zn && zn.length
        ? `<p class="n-znacke">${zn.map(z => `<span>${z}</span>`).join("")}</p>` : "");
    DRZAVA.napisi.appendChild(n);
    v.napisEl = n;
  });

  // zobci na premici = menjava poglavja, ne poljubna mreza
  seznam.forEach((v, i) => {
    if (i === 0 || seznam[i - 1].kader.pog === v.kader.pog) return;
    const zob = document.createElement("i");
    zob.style.left = (v.zacetek / rez.dolzina * 100) + "%";
    DRZAVA.zobi.appendChild(zob);
  });

  DRZAVA.stevec.textContent = "/" + seznam.length;
  DRZAVA.trak.setAttribute("aria-valuemax", String(rez.dolzina));
  postaviMrezo();
  izris(cas);
}

function postaviMrezo() {
  if (!zvokElement) return;
  zvokElement.src = `zvok/master-${stanje.rez}-${stanje.jezik}-splet.m4a`;
  zvokElement.load();
  naloziPodnapise();
}

/* ---------------- PODNAPISI ---------------- */
/* Isti niz cue-jev, kot je zapečen v izvoženi različici, je zdaj tudi brskalniška
   sled: <track kind="captions"> z isto datoteko .vtt. Crta se riše iz lastnega
   seznama sledi in iz ure spota, ne iz dogodka cuechange — ura spota je namreč
   edina, ki teče tudi, ko film predvajamo tiho ali ga prekinemo s potegom po
   premici. */
function naloziPodnapise() {
  cueji = [];
  podnapisiManjkajo = false;
  izrisPodnapis(cas);
  const stara = DRZAVA.podnapisSled;
  if (stara) stara.remove();
  const nova = document.createElement("track");
  nova.kind = "captions";
  nova.srclang = stanje.jezik;
  nova.label = stanje.jezik === "sl" ? "Slovenščina" : "Angleščina";
  nova.src = `podnapisi/rka-${stanje.rez}-${stanje.jezik}-splet.vtt`;
  DRZAVA.zvok.appendChild(nova);
  DRZAVA.podnapisSled = nova;
  /* Brez tega Chrome sled drži kot izklopljeno in je nikoli ne naloži, tudi če
     obiskovalec crto prižge pozneje. */
  nova.track.mode = "hidden";
  nova.addEventListener("load", () => {
    cueji = nova.track.cues ? Array.from(nova.track.cues) : [];
    if (!cueji.length) { podnapisiManjkajo = true; oznaciPodnapise(); }
    izrisPodnapis(cas);
  });
  nova.addEventListener("error", () => {
    cueji = [];
    podnapisiManjkajo = true;
    stanje.podnapisi = false;
    oznaciPodnapise();
    izrisPodnapis(cas);
  });
  oznaciPodnapise();
}

function izrisPodnapis(s) {
  if (!stanje.podnapisi) { DRZAVA.podnapis.textContent = ""; return; }
  const aktivni = cueji.filter(k => s >= k.startTime && s < k.endTime);
  DRZAVA.podnapis.textContent = aktivni.map(k => k.text.split("\n").join(" ")).join(" · ");
}

function preklopiPodnapise(vrednost) {
  stanje.podnapisi = vrednost === undefined ? !stanje.podnapisi : vrednost;
  document.body.classList.toggle("podnapisi-on", stanje.podnapisi);
  oznaciPodnapise();
  izrisPodnapis(cas);
}

function oznaciPodnapise() {
  DRZAVA.gumbPodnapisi.setAttribute("aria-pressed", String(stanje.podnapisi));
  DRZAVA.gumbPodnapisi.textContent = podnapisiManjkajo ? "Podnapisi zmanjkajo" : "Podnapisi";
}

function napisiNapako(besedilo) {
  if (DRZAVA.vLede) DRZAVA.vLede.textContent = besedilo;
}

/* ---------------- IZRIS ---------------- */
function indeksNa(s) {
  for (let i = seznam.length - 1; i >= 0; i--) if (s >= seznam[i].zacetek) return i;
  return 0;
}

function izris(s) {
  if (!seznam.length) return;
  const enota = SPOT.rezi[stanje.rez].dolzina;
  s = Math.max(0, Math.min(enota, s));
  const i = indeksNa(s);
  const v = seznam[i];

  seznam.forEach((w, j) => {
    if (j < i) { w.el.style.clipPath = ""; w.el.classList.add("vidno"); }
    else if (j > i) { w.el.style.clipPath = skriti(w); w.el.classList.remove("vidno"); }
  });

  /* Prvi kader se ne brise čez nicelni sloj — brez predhodnega kadra je od začetka
     ves viden, sicer je ustavljen na nuli črn zaslon. */
  const napred = (i === 0 || BLADENJE) ? 1 : Math.min(1, (s - v.zacetek) / REZ_TRAJANJE);
  v.el.classList.toggle("vidno", napred >= 1);
  const rob = ((1 - napred) * 100).toFixed(2);
  v.el.style.clipPath = napred >= 1 ? ""
    : (v.smer < 0 ? `inset(0 0 0 ${rob}%)` : `inset(0 ${rob}% 0 0)`);

  // vodna crta potuje z rezom in ugasne, ko se kader usede
  if (napred < 1) {
    DRZAVA.reznica.style.opacity = String(0.25 + 0.75 * Math.sin(napred * Math.PI));
    DRZAVA.reznica.style.left =
      `calc(${((v.smer < 0 ? 1 - napred : napred) * 100).toFixed(2)}% - 13px)`;
  } else {
    DRZAVA.reznica.style.opacity = "0";
  }

  // crni ugriz ob menjavi poglavja
  const novPoglavje = i > 0 && seznam[i - 1].kader.pog !== v.kader.pog;
  const odr = s - v.zacetek;
  DRZAVA.crni.style.opacity =
    (novPoglavje && !BLADENJE && odr < 0.30) ? String(0.62 * (1 - odr / 0.30)) : "0";

  /* Ken Burns: ublažena hoja, mirna roka in odmev ob rezu. Konec okna ostane na
     isti točki kot prej — spremeni se samo to, kako do njega pride, zato okvir na
     rezu ne skokne in izvoz ostane poravnan s predvajalnikom. */
  if (v.gib && !BLADENJE && v.kader.vrsta === "slika") {
    const od = s - v.zacetek;
    const t = ublaz(Math.min(1, od / v.okno));
    const [dx, dy] = roka(v.id, s);
    const pi = i > 0 ? 1 + PI_AMPL * Math.exp(-PI_UPOC * od / PI_TRAJ) : 1;
    const gib = v.kader.gib;
    let transform = "";
    if (gib === "push") transform = `scale(${((1.02 + 0.10 * t) * pi).toFixed(4)}) translate(${(0.6 * t + dx).toFixed(3)}%, ${(-0.5 * t + dy).toFixed(3)}%)`;
    else if (gib === "pull") transform = `scale(${((1.12 - 0.10 * t) * pi).toFixed(4)}) translate(${(-0.6 * t + dx).toFixed(3)}%, ${(0.5 * t + dy).toFixed(3)}%)`;
    else if (gib === "panL") transform = `scale(${(1.14 * pi).toFixed(4)}) translate(${(3.4 - 6.8 * t + dx).toFixed(3)}%, ${dy.toFixed(3)}%)`;
    else if (gib === "panR") transform = `scale(${(1.14 * pi).toFixed(4)}) translate(${(-3.4 + 6.8 * t + dx).toFixed(3)}%, ${dy.toFixed(3)}%)`;
    if (transform) v.gib.style.transform = transform;
  }

  /* Podnapis se zabrisi iz casa, ki ga posreduje klicatelj, ne iz CSS prehoda:
     okvir, ki ga vidi brskalnik, mora biti okvir, ki ga izvozi render. */
  seznam.forEach(w => {
    if (!w.napisEl) return;
    const vhod = w.zacetek + REZ_TRAJANJE * 0.55;
    if (BLADENJE) {
      const notranj = s >= vhod && s < w.konec + FADE;
      w.napisEl.style.opacity = notranj ? "1" : "0";
      w.napisEl.style.transform = "";
      w.napisEl.classList.toggle("vidno", notranj);
      return;
    }
    const a = Math.min(Math.max(0, (s - vhod) / FADE),
                       Math.max(0, (w.konec + FADE - s) / FADE), 1);
    w.napisEl.style.opacity = a.toFixed(3);
    w.napisEl.style.transform = `translateY(${((1 - Math.min(1, Math.max(0, (s - vhod) / FADE))) * 10).toFixed(2)}px)`;
    w.napisEl.classList.toggle("vidno", a > 0.02);
  });

  DRZAVA.kader.textContent = v.id;
  /* Podnapis riše enaka ura kot kadre, zato ostane v koraku tudi med tihim
     predvajanjem in potegom po premici. */
  izrisPodnapis(s);
  DRZAVA.pog.textContent = poglavje(v.kader.pog);
  DRZAVA.ura.textContent = videokadar(s, SPOT.sricje);
  const delezi = s / enota;
  DRZAVA.zapolni.style.width = (delezi * 100) + "%";
  DRZAVA.kaza.style.left = (delezi * 100) + "%";
  DRZAVA.cas.textContent = sekunde(s) + " / " + sekunde(enota);
  DRZAVA.trak.setAttribute("aria-valuenow", String(Math.round(s)));
  DRZAVA.trak.setAttribute("aria-valuetext", `${Math.round(s)} sekund od ${Math.round(enota)}`);

  DRZAVA.konec.hidden = !(s >= enota - 0.001 && !predvaja);
}

/* ---------------- URA ---------------- */
function tik(zd) {
  if (!predvaja) return;
  const enota = SPOT.rezi[stanje.rez].dolzina;
  if (zvokElement && !zvocnaNapaka && stanje.zvuk && !zvokElement.paused) {
    cas = zvokElement.currentTime;
    zadnjiTik = zd;
  } else {
    cas += (zd - zadnjiTik) / 1000;
    zadnjiTik = zd;
  }
  if (cas >= enota) { cas = enota; ustavi(); return; }
  izris(cas);
  requestAnimationFrame(tik);
}

function predvajaj(od = null) {
  if (od !== null) cas = Math.max(0, Math.min(SPOT.rezi[stanje.rez].dolzina, od));
  DRZAVA.konec.hidden = true;
  predvaja = true;
  zadnjiTik = performance.now();
  if (zvokElement && !zvocnaNapaka) {
    if (stanje.zvuk) {
      zvokElement.currentTime = cas;
      const obet = zvokElement.play();
      if (obet) obet.catch(() => { zvocnaNapaka = true; oznaciZvok(); });
    } else {
      zvokElement.pause();
    }
  }
  preoblikujGumb();
  requestAnimationFrame(tik);
  budiOpremo();
}

function ustavi() {
  predvaja = false;
  if (zvokElement) zvokElement.pause();
  preoblikujGumb();
  izris(cas);
  prikaziOpremo();
}

function preklopi() { predvaja ? ustavi() : predvajaj(); }

function skociNaKader(za) {
  const i = Math.max(0, Math.min(seznam.length - 1, indeksNa(cas) + za));
  const cilj = seznam[i].zacetek;
  if (predvaja) { predvajaj(cilj); return; }
  cas = cilj;
  if (zvokElement && !zvocnaNapaka) zvokElement.currentTime = cilj;
  izris(cas);
}

function preoblikujGumb() {
  DRZAVA.gumbUstavi.setAttribute("aria-label",
    predvaja ? "Ustavi predvajanje" : "Nadaljuj predvajanje");
  DRZAVA.gumbUstavi.innerHTML = predvaja
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor"/></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l12 7-12 7z" fill="currentColor"/></svg>`;
}

/* ---------------- RAZLICICE ---------------- */
function nastaviRez(rez) {
  if (rez === stanje.rez) return;
  const bilPredvajan = predvaja;
  ustavi();
  stanje.rez = rez; cas = 0;
  stikala();
  zgradi();
  naloziNamreke().then(() => { if (bilPredvajan) predvajaj(0); });
}

function nastaviJezik(j) {
  if (j === stanje.jezik) return;
  const bilPredvajan = predvaja;
  ustavi();
  stanje.jezik = j; cas = 0;
  document.documentElement.lang = j === "sl" ? "sl" : "en";
  stikala();
  zgradi();
  naloziNamreke().then(() => { if (bilPredvajan) predvajaj(0); });
}

/* Pokoncni rez ni jezik ali dolzina: platna ni treba graditi znova, ker razmerje
   nosi samo CSS in ga nobena tipka ne preklaplja. Neznana vrednost pade na
   lezeceg, da uvoznik ne more tiho dobiti polovicne slike. */
function nastaviRazmerje(r) {
  if (r !== "9x16" && r !== "16x9") return;
  stanje.razmerje = r;
  document.body.classList.toggle("pokonci", r === "9x16");
}

function stikala() {
  DRZAVA.gumb60.setAttribute("aria-pressed", String(stanje.rez === "60"));
  DRZAVA.gumb30.setAttribute("aria-pressed", String(stanje.rez === "30"));
  DRZAVA.v60.setAttribute("aria-pressed", String(stanje.rez === "60"));
  DRZAVA.v30.setAttribute("aria-pressed", String(stanje.rez === "30"));
  DRZAVA.vSl.setAttribute("aria-pressed", String(stanje.jezik === "sl"));
  DRZAVA.vEn.setAttribute("aria-pressed", String(stanje.jezik === "en"));
  DRZAVA.gumbJezik.textContent = stanje.jezik.toUpperCase();
  DRZAVA.kOne.textContent = SPOT.rezi[stanje.rez].dolzina === 30
    ? "Konec tridesetih sekund. Ostane številka."
    : "Konec minute. Ostane številka.";
  oznaciZvok();
}

function oznaciZvok() {
  const pripravljen = stanje.zvuk && !zvocnaNapaka;
  DRZAVA.gumbZvuk.setAttribute("aria-pressed", String(pripravljen));
  DRZAVA.gumbZvuk.textContent = zvocnaNapaka ? "Zvok zmanjka" : stanje.zvuk ? "Zvok" : "Tiho";
}

function nastaviZvok(on) {
  stanje.zvuk = on;
  if (!on && zvokElement) zvokElement.pause();
  oznaciZvok();
  if (predvaja) predvajaj(cas);
}

/* ---------------- BESEDILO ---------------- */
function delezGovora() {
  const p = seznam.reduce((a, v) => a + (v.vrstica ? v.vrstica.govor : 0), 0);
  return p / SPOT.rezi[stanje.rez].dolzina * 100;
}

function zgradiBesedilo() {
  const enota = SPOT.rezi[stanje.rez].dolzina;
  const z = SPOT.zvok;
  const glas = stanje.jezik === "sl" ? z.pripoved_sl : z.pripoved_en;
  let html = `<div class="bes-glava">
      <h2>${SPOT.rezi[stanje.rez].naslov}</h2>
      <p>${seznam.length} kadrov v ${enota} s · pripoved ${stanje.jezik === "sl" ? "slovensko" : "angleisko"}</p>
    </div>`;
  let zadnjiPog = "";
  seznam.forEach(v => {
    if (v.kader.pog !== zadnjiPog) {
      zadnjiPog = v.kader.pog;
      html += `<p class="bes-poglavje">${poglavje(zadnjiPog)}<span>${sekunde(v.zacetek)}</span></p>`;
    }
    const merjeni = v.vrstica
      ? `${sekunde(v.vrstica.zac)}–${sekunde(v.vrstica.konec)} · ${v.vrstica.govor.toFixed(2)} s`
      : "brez govora";
    html += `<button class="bes-vrstica" data-cas="${v.zacetek}">
        <span class="bes-ura">${sekunde(v.zacetek)}</span>
        <span class="bes-t">${v.napis}<i>${v.id} · okvir ${v.okno.toFixed(2)} s · ${merjeni}</i></span>
      </button>`;
  });
  html += `<div class="bes-noga">
      <p><b>Zasedenost govora.</b> ${delezGovora().toFixed(1)} % enote je izgovorjenega —
      ostalo je zrak, da rez diha.</p>
      <p><b>Pripoved.</b> ${glas.glas} · ${glas.licenca}${glas.model ? " · " + glas.model : ""}.
      Glas je nevtronski model, treniran na posnetem govorcu, ne zvočni niz iz lazni.</p>
      <p><b>Zvocna podlaga.</b> ${z.podlaga.vir} — ${z.podlaga.licenca}. ${z.podlaga.opomba}</p>
      <p><b>Glasnost.</b> Televizija ${z.glasnost.televizija}; splet ${z.glasnost.splet}.
      Trajanje in izmerjena raven vsakega izvoza sta v
      <code>zvok/namera-${stanje.rez}-${stanje.jezik}.json</code>.</p>
    </div>`;
  DRZAVA.besNotranji.innerHTML = html;
}

function odpriBesedilo() {
  ustavi();
  zgradiBesedilo();
  DRZAVA.besedilo.hidden = false;
  DRZAVA.besedilo.scrollTop = 0;
  skrijVrata();
  DRZAVA.gumbTekst.setAttribute("aria-pressed", "true");
}

function zapriBesedilo() {
  DRZAVA.besedilo.hidden = true;
  DRZAVA.gumbTekst.setAttribute("aria-pressed", "false");
  izris(cas);
}

/* ---------------- NAMREKI (polozaji vrstic iz merjenja) ---------------- */
async function naloziNamreke() {
  const pot = `zvok/namera-${stanje.rez}-${stanje.jezik}.json`;
  try {
    const odgovor = await fetch(pot, { cache: "no-store" });
    if (!odgovor.ok) throw new Error(String(odgovor.status));
    const podatki = await odgovor.json();
    const poKadru = {};
    (podatki.vrstice || []).forEach(v => { poKadru[v.kader] = v; });
    seznam.forEach(v => { v.vrstica = poKadru[v.id] || null; });
    zvocnaNapaka = false;
  } catch (e) {
    zvocnaNapaka = true;
    seznam.forEach(v => { v.vrstica = null; });
  }
  oznaciZvok();
}

/* ---------------- POGLEDI ---------------- */
function preklopiVarnoCono() {
  const on = DRZAVA.varnost.classList.toggle("on");
  DRZAVA.gumbVarnost.setAttribute("aria-pressed", String(on));
}

function celZaslon() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}

function skrijVrata() {
  DRZAVA.vrata.classList.add("bliski");
  setTimeout(() => { DRZAVA.vrata.hidden = true; }, 480);
}

function zacni(zvok) {
  stanje.zvuk = zvok;
  oznaciZvok();
  skrijVrata();
  predvajaj(0);
}

function premikPoTraku(e, pravokotnik) {
  const delezi = Math.max(0, Math.min(1, (e.clientX - pravokotnik.left) / pravokotnik.width));
  cas = delezi * SPOT.rezi[stanje.rez].dolzina;
  if (!predvaja) {
    const i = indeksNa(cas);
    cas = seznam[i].zacetek;              // brez predvajanja se ustavi na okvirju kadra
    if (zvokElement && !zvocnaNapaka) zvokElement.currentTime = cas;
  }
  izris(cas);
}

/* ---------------- ZAGON ---------------- */
async function zazeni() {
  try {
    const odgovor = await fetch("spot.json", { cache: "no-store" });
    if (!odgovor.ok) throw new Error(String(odgovor.status));
    SPOT = await odgovor.json();
  } catch (e) {
    napisiNapako("Casovni list spot.json ni dosegljiv. Streznji mapo z naloznikom, npr. python -m http.server.");
    return;
  }

  /* Zvok je DOM element, ne new Audio(): brskalnik .vtt sled pripne le elementu,
     ki živi v dokumentu. */
  zvokElement = DRZAVA.zvok;
  zvokElement.addEventListener("error", () => { zvocnaNapaka = true; oznaciZvok(); });

  stikala();
  zgradi();
  await naloziNamreke();
  preoblikujGumb();

  DRZAVA.kTel.href = "tel:" + SPOT.zakljucek.tel;

  DRZAVA.gumbUstavi.addEventListener("click", preklopi);
  DRZAVA.gumbNazaj.addEventListener("click", () => skociNaKader(-1));
  DRZAVA.gumbNaprej.addEventListener("click", () => skociNaKader(1));
  DRZAVA.gumb60.addEventListener("click", () => nastaviRez("60"));
  DRZAVA.gumb30.addEventListener("click", () => nastaviRez("30"));
  DRZAVA.gumbJezik.addEventListener("click", () =>
    nastaviJezik(stanje.jezik === "sl" ? "en" : "sl"));
  DRZAVA.gumbZvuk.addEventListener("click", () => nastaviZvok(!stanje.zvuk));
  DRZAVA.gumbTekst.addEventListener("click", () =>
    DRZAVA.besedilo.hidden ? odpriBesedilo() : zapriBesedilo());
  DRZAVA.gumbVarnost.addEventListener("click", preklopiVarnoCono);
  DRZAVA.gumbPodnapisi.addEventListener("click", () => preklopiPodnapise());
  DRZAVA.gumbCelost.addEventListener("click", celZaslon);
  DRZAVA.gumbNazajFilm.addEventListener("click", zapriBesedilo);
  DRZAVA.kPonovi.addEventListener("click", () => predvajaj(0));
  DRZAVA.kBesedilo.addEventListener("click", odpriBesedilo);

  DRZAVA.v60.addEventListener("click", () => nastaviRez("60"));
  DRZAVA.v30.addEventListener("click", () => nastaviRez("30"));
  DRZAVA.vSl.addEventListener("click", () => nastaviJezik("sl"));
  DRZAVA.vEn.addEventListener("click", () => nastaviJezik("en"));
  DRZAVA.vPredvajaj.addEventListener("click", () => zacni(true));
  DRZAVA.vBrezZvoka.addEventListener("click", () => zacni(false));

  DRZAVA.besNotranji.addEventListener("click", e => {
    const gumb = e.target.closest("[data-cas]");
    if (!gumb) return;
    zapriBesedilo();
    predvajaj(Number(gumb.dataset.cas));
  });

  DRZAVA.trak.addEventListener("pointerdown", e => {
    const pravokotnik = DRZAVA.trak.getBoundingClientRect();
    const bilPredvajan = predvaja;
    ustavi();                             // med vlecenjem ura ne sme tekci proti prstu
    DRZAVA.trak.setPointerCapture(e.pointerId);
    premikPoTraku(e, pravokotnik);
    const naPremiku = ev => premikPoTraku(ev, pravokotnik);
    DRZAVA.trak.addEventListener("pointermove", naPremiku);
    DRZAVA.trak.addEventListener("pointerup", () => {
      DRZAVA.trak.removeEventListener("pointermove", naPremiku);
      if (bilPredvajan) predvajaj(cas);
    }, { once: true });
  });

  document.addEventListener("keydown", e => {
    if (DRZAVA.besedilo.hidden === false && e.key !== "Escape") return;
    const k = e.key.toLowerCase();
    if (k === "escape") { if (!DRZAVA.besedilo.hidden) zapriBesedilo(); return; }
    if (k === " " || k === "spacebar") {
      e.preventDefault();
      if (!DRZAVA.vrata.hidden) zacni(true); else preklopi();
      return;
    }
    if (k === "arrowright") { e.preventDefault(); skociNaKader(1); }
    else if (k === "arrowleft") { e.preventDefault(); skociNaKader(-1); }
    else if (k === "f") celZaslon();
    else if (k === "t") DRZAVA.besedilo.hidden ? odpriBesedilo() : zapriBesedilo();
    else if (k === "v") preklopiVarnoCono();
    else if (k === "p") preklopiPodnapise();
    else if (k === "m") nastaviZvok(!stanje.zvuk);
    else if (k === "e") nastaviRez(stanje.rez === "60" ? "30" : "60");
    else if (k === "j") nastaviJezik(stanje.jezik === "sl" ? "en" : "sl");
  });
}

/* Izvoznik slika platno po okvirjih in zanj oprema predvajalnika ni del slike. */
const POIZVEDBA = new URLSearchParams(location.search);
if (POIZVEDBA.has("render")) document.body.classList.add("render");
/* 9:16 je nacin uvoza, ne odzivnost: ziva stran se ne spremeni tudi na
   telefonu, da obiskovalec ne dobi pasu, ki ga ni nihce odobril. */
nastaviRazmerje(POIZVEDBA.get("razmerje") || "16x9");

zazeni();

/* SPODNJA VARNA CONA SLEDI TRANSPORTU. Na ozkem zaslonu se kontrolna vrstica
   zloži v toliko vrstic, kot jih zahteva jezik in širina, zato je vsaka fiksna
   številka v CSS uganjenka: pri 320 px so štiri vrstice visoke 159 px, varna cona
   pa je bila 140 px — napis bi sedel čez gumbe. Namesto ugibanja se vzame
   izmerjena višina. V izvoznem načinu se ne vmešava: tam transporta ni, slika pa
   ne sme zaradi opreme predvajalnika premakniti niti enega kadra. */
const ROB_POG = matchMedia("(max-aspect-ratio:4/5), (max-width:620px)");
function poravnajRob() {
  if (document.body.classList.contains("render")) return;
  const koren = document.documentElement.style;
  if (!ROB_POG.matches) { koren.removeProperty("--rob-s"); return; }
  const v = DRZAVA.transport.offsetHeight;
  if (v > 0) koren.setProperty("--rob-s", Math.round(v + 18) + "px");
}
new ResizeObserver(poravnajRob).observe(DRZAVA.transport);
ROB_POG.addEventListener("change", poravnajRob);
poravnajRob();

/* OPREMA, KI ZASPI MED PREDVAJANJEM. Kader je reklama, ne predvajalnik:
   kontrolna vrstica in tipkovna navodila se po OPREMA_MIR umaknejo, vrne pa
   ju katerikoli znak pozornosti (miška, dotik, tipka, fokus) ali pavza. V
   izvoznem načinu se ne vpiše niti en razred — tam je opreme z `display:none`
   že ni, izvoznik pa ne sme dobiti preklopa, ki bi lahko premaknil sliko. */
const OPREMA_MIR = 2500;
let oprema_ur = null;

function prikaziOpremo() {
  clearTimeout(oprema_ur);
  oprema_ur = null;
  document.body.classList.remove("oprema-skriti");
}

function budiOpremo() {
  if (document.body.classList.contains("render")) return;
  clearTimeout(oprema_ur);
  document.body.classList.remove("oprema-skriti");
  if (predvaja)
    oprema_ur = setTimeout(() => document.body.classList.add("oprema-skriti"), OPREMA_MIR);
}

/* passive: med premikom miške smemo samo brati, drsenja ne preprečiti. */
for (const dog of ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "focusin"])
  window.addEventListener(dog, budiOpremo, { passive: true });
