const fs = require("fs");
const crypto = require("crypto");
const TEMP = process.env.TEMP;
const CILJ = "C:/Users/admin/Downloads/sssdf/rka-onepage/orodja";

// Zavrženo izrecno: merila, ki lažejo, ali enkratni diagnostični posnetki.
const IZVZETO = {
  "rka-pregled.cjs": "nadomeščeno: samo trije pogledi namesto matrike 5×6",
  "rka-meri3.cjs": "nadomeščeno: šteje 'slabih pogledov: N/18' preozko",
  "rka-meritve.cjs": "ne za razsodbe: meri z --window-size, 1440×900 da viewport 805 px",
  "rka-pv-zivjo-ubij.ps1": "ubija procese — ne spada v gradnik",
  "rka-pid-poisci.ps1": "enkratni iskalnik PID",
  "rka-cisti-harness.ps1": "enkratno čiščenje",
  "rka-oba-sintaksa.ps1": "enkraten preizkus sintakse",
  "rka-rezja-sintaksa.ps1": "enkraten preizkus sintakse",
  "rka-pokonci-poisci.ps1": "enkraten iskalnik",
  "rka-pokonci-primerjaj.py": "enkratna primerjava, nadomeščena s sondo",
  "rka-eol-diagnoza.cjs": "enkraten diagnostični izpis koncev vrstic",
  "rka-diff-preizkus.cjs": "enkraten preizkus diff atributa",
  "rka-drs-diagnoza.cjs": "enkraten vzorec 12 odčitkov; zaključek je v sondi in njeni mutaciji",
  "rka-ab-debug.cjs": "enkraten razhroščevalni izpis",
  "rka-oracle-proba.cjs": "poskus z orakljem, nikoli merilo",
  "rka-kaj.cjs": "zgodnji raziskovalni izpis",
  "rka-kaj2.cjs": "zgodnji raziskovalni izpis",
  "rka-zakaj.cjs": "zgodnji raziskovalni izpis",
  "rka-zakaj2.cjs": "zgodnji raziskovalni izpis",
  "rka-odstik.cjs": "zgodnji raziskovalni izpis",
  "rka-odstik2.cjs": "zgodnji raziskovalni izpis",
  "rka-meri2.cjs": "zgodnji raziskovalni izpis",
  "rka-sonda.cjs": "zgodnji raziskovalni izpis",
  "rka-sonda2.cjs": "zgodnji raziskovalni izpis",
  "rka-mutacija.cjs": "nadomeščeno z rka-drsenje-mutacija.cjs",
  "rka-mutacija2.cjs": "nadomeščeno z rka-drsenje-mutacija.cjs",
  "rka-gal-sonda.cjs": "enkraten pregled galerije",
  "rka-gal2.cjs": "enkraten pregled galerije",
  "rka-sonda-dekod.cjs": "enkraten dekoderski izpis",
  "rka-sonda-info.cjs": "enkraten izpis ffprobe",
  "rka-sonda-vir.cjs": "enkraten izvirniški izpis",
  "rka-pokonci-slike.cjs": "slikovni pripomoček za mero, ki jo je kasneje nadomestila sonda",
  "rka-yt.cjs": "zgodnji YouTube raziskovalni izpis",
  "rka-ytposlus.cjs": "zgodnji YouTube raziskovalni izpis",
  "rka-konkurenca.cjs": "poskus s konkurenco, ne merilo tega projekta",
  "rka-pasove.py": "enkraten izpis pasov",
  "rka-glaspi-proveri.py": "droben preizkus glasbe"
};

const VLOGA = {
  "rka-render.cjs": "izvoznik: 8 platn prek CDP v mp4 (60/30, sl/en, 16×9 in 9×16)",
  "rka-streznik.cjs": "statični strežnik z odzivom 206, ki ga sonde same zaženejo na 4194–4197",
  "rka-postrezi-predogled.cjs": "byte-range pregledovalni strežnik 4185 za video in zvok",
  "rka-mux.py": "zloži izvožena platna z izmerjenimi zvočnimi masterji v 14 izdelkov",
  "rka-zvok.py": "zgradi zvočne masterje (veriga FX in meritve LUFS/TP/LRA)",
  "rka-efekti-naredi.py": "regenerira FX iz namera-*.json",
  "rka-efekti-mera.py": "izmere na verigi FX",
  "rka-glas.py": "generira pripoved po kadrih",
  "rka-ritem.py": "izdela utripno mapo iz 128 BPM",
  "rka-ritem-list.py": "izpiše časovni list",
  "rka-ritem-kontrola.py": "kontrola utripne mape proti oknom",
  "rka-bit-preveri.py": "vrata: rez se ujema z utripno mapo",
  "rka-spot-jezik.py": "zamenja jezik pripovedi v času spota",
  "rka-jezik-preveri.py": "vrata: jezikovna skladnost (sl/en)",
  "rka-jezik-mutacija.py": "falsifikacija jezikovnih vrat",
  "rka-podnapisi.py": "zgradi podnapise .vtt",
  "rka-podnapisi-preveri.py": "vrata: podnapisi v mp4",
  "rka-podnapisi-mutacija.py": "falsifikacija podnapisnih vrat",
  "rka-podnapisi-strani-preveri.cjs": "vrata: štiri .vtt (2 reza × 2 jezik) priklopljeni na zgodba.html; trdi štiri stvari",
  "rka-podnapisi-strani-mutacija.py": "falsifikacija stranih podnapisnih vrat",
  "rka-izvoz-preveri.py": "vrata: 14 izdelkov (geometrija, zvok, črni okvirji)",
  "rka-izvoz-mutacija.py": "falsifikacija izvoznih vrat",
  "rka-izvoz-okvir.cjs": "edini legitimni način geometrije izvoza: izris(t) + okvir iz mp4 + iskanje odmika",
  "rka-izvoz-okvir.py": "spremljevalec okvirne meritve",
  "rka-sonda-crno.cjs": "sonda črnih okvirjev",
  "rka-gib-sonda.cjs": "vrata žive plasti: osem trditev (ROB, PORIV, PRESLIKAVA, KONC, UTRIP, DETERMINIZEM, ŽIVA STRAN, SMER)",
  "rka-gib-mutacija.py": "falsifikacija gibčnih vrat: osem virovno vezanih mutacij",
  "rka-pilot-gib.py": "dvanajstsekundni pilot žive plasti",
  "rka-pilot-zvok.py": "zvočni pilot",
  "rka-zgodba-sonda.cjs": "vrata strani zgodba.html: 272 meritev (pet zaslonov × dva jezika in dve izvozni okni)",
  "rka-zgodba-mutacija.cjs": "falsifikacija vrat strani zgodba.html: trinajst mutacij",
  "rka-zgodba-sonda-mutacija.py": "falsifikacija trditve zavrtja do dna v pomirjeni postavitvi",
  "rka-drsenje-sonda.cjs": "vrata: matrika pet zaslonov × šest pregledov, dvojno vzorčena",
  "rka-drsenje-mutacija.cjs": "falsifikacija vrat drsenja; sondo bere iz sonde, da mera obstaja enkrat",
  "rka-pokonci-sonda.cjs": "raziskovalna sonda 9×16 (meri, kaj se zgodi; ne razsodja — razsodja rka-pokonci-preveri.cjs)",
  "rka-pokonci-mutacija.py": "falsifikacija pokončnih vrat: sedem mutacij",
  "rka-vednost-preveri.py": "vrata: nobena sled mutacij ne sme ostati v virih (izvirnik natanko enkrat, mutacija odsotna)",
  "rka-deljena-preveri.py": "vrata delitvene slike in JSON-LD: vsak podatek mora biti iz vira",
  "rka-deljena-mutacija.py": "falsifikacija deljenih vrat: devetinštirideset mutacij",
  "rka-postavi-osnovo.cjs": "prepisovalnik javne osnovne URL (--base=… --zapisi)",
  "rka-slike-brez-js.cjs": "edini način videti stanje brez JavaScripta: skripti izklopljeni pred navigacijo",
  "rka-prekryv.cjs": "detektor prekrivanja naslikanih pravokotnikov (upšteva overflow in prosojnost)",
  "rka-sonda-odrin.cjs": "geometrijska sonda po posameznem otroku",
  "rka-pisava-sonda.cjs": "sonda pisav in berljivosti",
  "rka-sumniki-sonda.cjs": "sonda ločil in presledkov v besedilu",
  "rka-ozadje-proveri.cjs": "vrata ozadja v heroju",
  "rka-ozadje-mutacija.py": "falsifikacija vrat ozadja",
  "rka-svetlost.cjs": "mera svetlosti (zgodnja verzija)",
  "rka-svetlost.py": "vrata luminance slik",
  "rka-zivost-meri.py": "analiza živosti referenčnih reklam — osnova naročila",
  "rka-razlika.py": "pomožna mera pikslovne razlike",
  "rka-tempo.py": "mera tempa rezov",
  "rka-podlaga-mera.py": "mera glasbene podlage",
  "rka-posnetki.cjs": "inventura posnetkov",
  "rka-posnetki-izvozi.cjs": "izvoz inventure posnetkov",
  "rka-posnetki-proveri.py": "vrata inventure posnetkov",
  "rka-baz-naredi.cjs": "zgradi seznam kadrov",
  "rka-slikovni-ab.py": "A/B s pikslovno razliko: živa plast proti varovani kopiji na 8 platnih × 12 točk (96 parov)",
  "rka-slikovni-ab-mutacija.py": "falsifikacija slikovnega A/B: štiri mutacije",
  "rka-ab-sonda.cjs": "slušalna A/B stran: enaindvajset funkcionalnih prever",
  "rka-ab-mutacija.py": "falsifikacija slušalne A/B strani: sedem mutacij",
  "rka-ab-naredi.py": "zgradi slušalno A/B stran",
  "rka-ab-streznik.py": "byte-range strežnik 4188 za slušalno A/B stran",
  "rka-zivjo-sliki.cjs": "preverba strani primerjava-zivjo.html v pravem brskalniku (posnetek in napake)",
  "rka-klon-primerjava.cjs": "dokaz: delovna kopija je bajtsko enak HEAD; klon se pred primerjavo vedno pripelje na HEAD vira",
  "rka-klon-mutacija.cjs": "falsifikacija dokaza o klonu: mutacija delovne kopije doda natanko eno razliko, obnova pusti bajtsko enak izvirnik",
  "rka-orodja-sintaksa.cjs": "pregled sintakse vseh orodij (node --check, py_compile) nad poljubno mapo",
  "rka-pred-objavo-scan.cjs": "pred objavo: iskanje žetonov in skrivnosti v drevesu, ki ga bo git oddal",
  "rka-ps1-preveri.ps1": "analiza vseh .ps1 prek PowerShell Parserja (samo branje)",
  "rka-320-slika.cjs": "zaslonske slike najhujših primerov gostote postavitve",
  "rka-rezja-veriga.ps1": "veriga celotne rezje",
  "rka-rezja-zaganjalo.ps1": "zaganjalo rezje",
  "rka-ab-zaganjalo.ps1": "zaganjalo slušalne A/B verige",
  "rka-ab-opazovalec.ps1": "opazovalec slušalne A/B verige",
  "rka-pregled-harness.ps1": "pregled stanja merilnih skriptov",
  "rka-drsenje.cjs": "zgodnja mera drsenja; razsodbe nosi rka-drsenje-sonda.cjs",
  "rka-ozadje-casovnica.cjs": "časovnica ozadja v heroju (kdaj mora biti viden)",
  "rka-pokonci-preveri.cjs": "vrata pokončnega reza 9×16: sedem trditev, njihov dokaz je rka-pokonci-mutacija.py",
  "rka-orodja-kopiraj.cjs": "uvoznik orodij iz %TEMP% v mapo orodja, s sha256 in manifestom"
};

const seznam = fs.readdirSync(TEMP)
  .filter((f) => /^rka-.*\.(cjs|py|ps1)$/.test(f) && !IZVZETO[f])
  .sort();
fs.mkdirSync(CILJ, { recursive: true });
let kopiranih = 0;
const napake = [], brezVloge = [], izvenVloge = Object.keys(VLOGA).filter((f) => !seznam.includes(f));
const manifest = {};
for (const f of seznam) {
  const izvor = fs.readFileSync(TEMP + "/" + f);
  fs.writeFileSync(CILJ + "/" + f, izvor);
  const kopija = fs.readFileSync(CILJ + "/" + f);
  const a = crypto.createHash("sha256").update(izvor).digest("hex");
  if (a !== crypto.createHash("sha256").update(kopija).digest("hex")) {
    napake.push(f + "  se razlikuje takoj po kopiranju");
    continue;
  }
  if (!VLOGA[f]) brezVloge.push(f);
  manifest[f] = { sha256: a, bajti: izvor.length, vloga: VLOGA[f] || "VLOGA NI ZAPISANA" };
  kopiranih++;
}
fs.writeFileSync(CILJ + "/manifest.json", JSON.stringify({
  ustvarjeno: "2026-10-27", vir: "%TEMP%", opomba:
    "Kopiji sta nespremenjeni; skripti imajo absolutne poti te stroja (rka-onepage, rka-reklama, %TEMP%).",
  kopiranih, izvzeto: IZVZETO, datoteke: manifest
}, null, 2) + "\n");
const niVTempu = Object.keys(IZVZETO).filter((f) => !fs.existsSync(TEMP + "/" + f));
console.log("kopiranih: " + kopiranih + " | napak: " + napake.length +
  " | brez vloge: " + brezVloge.length + " | vloga brez datoteke: " + izvenVloge.length +
  " | izvzeti, ki jih ni v Tempu: " + niVTempu.length);
niVTempu.forEach((f) => console.log("  NI V TEMPU " + f));
brezVloge.forEach((f) => console.log("  BREZ VLOGE " + f));
izvenVloge.forEach((f) => console.log("  VLOGA BREZ DATOTEKE " + f));
napake.forEach((n) => console.log("  " + n));
