# River Kolpa Apartments — spletna stran in filmski rez

Tržni gradivo za **River Kolpa Apartments** (Majda Pezdirc, Griblje 70 in Griblje 30 b,
občina Črnomelj). V repozitoriju je vse, kar je potrebno za stran in za oglaševalski spot:
spletna stran brez drsenja, filmska stran s podnapisi, časovni list spota, zvočni masterji
z njihovimi meritvami in merilna orodja.

Stran **še ni javno objavljena**. Javni naslov (osnovni URL) še ni določen, zato so
metapodatki v stanju *brez osnove*: poti do slik so relativne, `canonical` in `og:url` pa
manjkata. Izvoženih MP4-jev tu ni — so produkt, ne vir (glej [Kaj namenoma
ni v repozitoriju](#kaj-namenoma-ni-v-repozitoriju)).

Vsaka številka v tem dokumentu je bodisi prebrana iz datoteke v repozitoriju bodisi
izmerjena z orodjem iz `orodja/`; kjer je vir naveden, je navedena tudi lokacija. Kjer
dokaz ne obstaja, piše **NEZAJETO** in ne domneva.

## Kazalo

- [Kaj je v repozitoriju](#kaj-je-v-repozitoriju)
- [Poslovni podatki, ki so fiksni](#poslovni-podatki-ki-so-fiksni)
- [`index.html` — stran brez drsenja](#indexhtml--stran-brez-drsenja)
- [`zgodba.html` — filmska stran](#zgodbahtml--filmska-stran)
- [`spot.json` — časovni list](#spotjson--časovni-list)
- [`zvok/` — pripoved, podlaga, masterji](#zvok--pripoved-podlaga-masterji)
- [Izvoženi izdelki](#izvoženi-izdelki)
- [Lokalni predogled](#lokalni-predogled)
- [Cevovod: od besedila do MP4](#cevovod-od-besedila-do-mp4)
- [Vrata in njihov dokaz](#vrata-in-njihov-dokaz)
- [`orodja/` — posnetek instrumentov in njegove meje](#orodja--posnetek-instrumentov-in-njegove-meje)
- [Licence in navedbe](#licence-in-navedbe)
- [Kaj namenoma ni v repozitoriju](#kaj-namenoma-ni-v-repozitoriju)
- [Odprte odločitve](#odprte-odločitve)
- [Git: identiteta, konci vrstic, potis](#git-identiteta-konci-vrstic-potis)
- [Seznam pred predajo](#seznam-pred-predajo)
- [Kaj vrata ne vedo](#kaj-vrata-ne-vedo)

## Kaj je v repozitoriju

**242 sledenih datotek, 33,58 MB (32,0 MiB).** Številka datotek je iz `git ls-files`; velikost je iz
velikosti na disku. Točna vsota bajtov se spreminja skupaj s tem README-jem, zato je ni
smisel navajati kot obljubo — ponovno jo izračunajte z:

```bash
git ls-files -z | xargs -0 stat -c %s | awk '{ s += $1 } END { print s }'
```

Zadnji izračun 2026-10-27: **33 581 564 B**. Ta odstavek je sam del vsote, zato številka
po vsaki uredbi te datoteke za nekaj bajtov zaostane za resničnostjo — po uredbi jo
izračunajte znova, ne popravljajte iz spomina.

| mapa | datotek | kaj |
|---|---|---|
| `(koren)` | 12 | `index.html`, `zgodba.html`, `deljena.html`, `app.js`, `zgodba.js`, `styles.css`, `zgodba.css`, `fonts.css`, `spot.json`, `README.md`, `.gitignore`, `.gitattributes` |
| `assets/` | 53 | 46 fotografij in posnetkov (lastniški), `kolpa-ozadje.mp4`, 6 `woff2` pisav |
| `zvok/` | 85 | 12 `master-*.m4a`, 4 `namera-*.json`, 64 posnetih govorov po kadrih, 4 `seznam.json`, `LICENCE.md` |
| `orodja/` | 80 | 79 merilnih in gradbenih skript + `manifest.json` |
| `fonts/` | 8 | 6 `woff2`, ki jih kliče `fonts.css` + 2 licenci OFL |
| `podnapisi/` | 4 | `rka-{60,30}-{sl,en}-splet.vtt` |

`zvok/` je razčlenjen tako: 22 posnetih govorov za rez :60 (`zvok/60-sl`, `zvok/60-en`),
10 za rez :30 (`zvok/30-sl`, `zvok/30-en`), vsak imenik ima svoj `seznam.json`.

**Neskladje, ki ga je našel ta pregled:** `assets/` vsebuje šest `woff2` datotek, ki jih
noben HTML, CSS ali JS ne kliče — `fonts.css:1-6` in povezavi `rel=preload`
(`index.html:64-65`, `zgodba.html:22-23`) kažejo na `fonts/`. Gre za ostanek pred
prestavitvijo, ne za vir. To je treba urediti (izbris ali uradna raba), ne prezreti.

## Poslovni podatki, ki so fiksni

Te podatke je potrdil lastnik; nobenega ne popravljajte iz kode ali iz domneve:

- **Objavljena trditev je »štirje samostojni apartmaji na dveh naslovih«** — Griblje 70 in
  Griblje 30 b. Ostane, tudi če se zdi, da bi moralo pisati »dva«.
- **Booking.com ima samo hišo Griblje 70.** Poziv nanj mora imenovati to hišo; Griblje 30 b
  ima pošto. Nikoli ne predstavljajte Booking povezave kot veljavne za obe hiše.
- **Prostih terminov stran ne objavlja**, zato se glasi »Povpraševanje«, ne »Prosti termini«.
  Poziv na filmski strani je »Povprašaj za termin«.
- **Razlogov ne podmetajte.** Stran navaja dejstva, ne razlag, ki jih lastnik ni izrekel.
- **Razpored ležišč na Griblje 30 b ni znan**, zato kartica pravi »razpored ležišč potrdimo
  ob povpraševanju«.
- **Ozadje je lasten posnetek** (Ken Burns čez lastne fotografije, dokler ne pride pravi
  posnetek Kolpe). Noben korak ne prevzame tretjega gradiva.
- **Jezikovni preklop SL/DE/EN je namenoma izpuščen**; stran je enojezična.
- Kontakti (`+386 40 858 732`, `majda.pezdirc@gmail.com`, matična 9057641000, davčna
  SI97033910) so v `index.html` JSON-LD in v `spot.json → zakljucek` — isti vir, ne dve
  različici.

## `index.html` — stran brez drsenja

`html{overflow:hidden}` (`styles.css:18`) in `overflow:hidden; overscroll-behavior:none`
(`styles.css:23`) pomenita, da obiskovalec **ne drsi**: vse, kar je v pogledu, je tudi
vidno. Vsebino nadzoruje `app.js`:

- `NAV` ima **6 pregledov** (`app.js:106`): `domov`, `h70`, `h30b`, `reka`, `galerija`,
  `termini` — Domov, Griblje 70, Griblje 30 b, Reka Kolpa, Galerija, Povpraševanje. Zgornja
  vrstica zamenja pogled in ima gumb Nazaj; prekrivnih panelov ni.
- `GOSTOTE = [1, .90, .82, .74, .66, .58, .50, .42]` (`app.js:370`), ki jo izbere
  `prilepi()` (`app.js:371`). Lestvica spreminja **samo** spremenljivko `--g`, ki krmari
  razmike, ne `font-size`: besedilo ostane enako veliko, stisne se zrak med bloki.
- `styles.css` ima poleg `prefers-reduced-motion` (vrstica 331) še **4 prelomne točke**:
  `max-width` 1080 (338), 620 (362), 400 (390) px in `max-height` 560 (398). Na najožjih
  pogledih bloki skrijejo ponavljajoče se sezname (`.lok .opombe li:nth-child(n+4)`,
  `.reka-list .rl:nth-child(n+4)`, `.pravila li:nth-child(n+3)`, `.chips`) in spremljevalne
  elemente (`.mnenje`, `.host`, `.fakti`, `.smini`). Vrata merijo, da **nič besedila ne
  štruri in da dokument ne drsi**; da na ožjem pogledu ne izgine podatek, ki obstaja samo
  tam, **ne preverja nobeno vrata** — to je odprta luknja, ne dokazana lastnost.
- Ozadje v heroju: YouTube zanka (`youtube-nocookie`) **ali** lastni `kolpa-ozadje.mp4`.
  `YT_ROK = 9000` ms (`app.js:473`) in pogoj `if (!youtube && (ytManjka || !ytPlast))`
  (`app.js:542`) zagotavljata, da se lokalni posnetek ne prenese, če je YouTube uspel. To
  trditev meri `rka-ozadje-proveri.cjs` tako, da **strežnik šteje bajte**.
- V `<noscript>` sta dva kosa: `<style>` (`index.html:72-76`), ki sprosti `overflow:hidden`
  — sicer bi prav to pravilo odrezalo rezervno besedilo — in besedilni blok z bistvenimi
  podatki (`index.html:111` naprej).

## `zgodba.html` — filmska stran

Ločen pogon: fluidni `clamp()` in `svh`-enote, brez reševalca gostote. Predvaja isti
časovni list kot izvoznik, zato je MP4 dokazljivo enak spletnemu predvajanju — skupna je
funkcija `izris(t)`.

Parametra naslova (`zgodba.js:669`):

| param | učinek |
|---|---|
| `?render=…` | vklopi `body.render`: brez nadzorne opreme predvajalnika, za izvoznik |
| `?razmerje=9x16` | vklopi `body.pokonci` — pokončni uvoz platna; **živa stran se ne spremeni**, tudi ne na telefonu |

Živa plast giba (`zgodba.js:9, 15-19, 42`):

| konstanta | vrednost | pomen |
|---|---|---|
| `REZ_TRAJANJE` | 0,30 s | dolžina vodnega reza med kadroma |
| `UBLAG` | 0,45 | cikloidna ublažitev: hoja se začne in konča počasneje, sredina je hitrejša; odvod je pri `UBLAG < 1` vedno pozitiven, zato kader nikoli ne gre nazaj |
| `ROKA_X` / `ROKA_Y` | 0,28 % / 0,20 % | amplituda mirne roke, v % širine sloja; deterministična (FNV-1a), pod 1 Hz |
| `PI_AMPL` | 0,016 | približaj ob rezu, v deležu povečave |
| `PI_TRAJ` / `PI_UPOC` | 0,9375 s / 3,2 | odmev traja dva utripa pri 128 BPM in eksponentno upade čez `PI_TRAJ` |
| `SMER_PREHODA` | `push 1, panR 1, pull −1, panL −1` | smer prenosa iz giba **vstopnega** kadra, da oko nadaljuje pot |

Komentar v `zgodba.js:13-14` je del dokumentacije in ga je treba upoštevati: *količine
spodaj so odločitev, ne izmerjena lastnost posnetka*. Vrata (`rka-gib-sonda.cjs`) torej
preverjajo, da te odločitve držijo v izrisu, ne da bi bile estetsko pravilne.

Podnapisi so pravi `<track kind="captions">` (`mode="hidden"`), vidno vrstico izriše
`izris(t)`; pričakovana besedila vrata berejo iz `.vtt` na disku, ne iz kode strani.

## `spot.json` — časovni list

> »Časovni list je edini vir resnice: stran ga predvaja, render ga izreže v MP4, sinteza
> pa iz njega bere pripoved.« — `spot.json → opomba`

| ključ | vsebina |
|---|---|
| `oznaka`, `naslov`, `opomba` | identiteta in pravilo enega vira |
| `sirina`, `visina`, `sricje` | 1920 × 1080 @ 30 fps (pokončno 1080 × 1920) |
| `zvok` | `pripoved_sl`, `pripoved_en`, `podlaga`, `glasnost` |
| `poglavja` | 5: Voda, Dve hiši, Vrt, Večer, Zaključek |
| `kadri` | niz **22** posnetkov (`k01` video … `k22` zaključek); `pog`, `vrsta`, `pot`, `poster`, `gib`, `sidro`, `eb`, `beso`, `pod`, `govorSl`, `govorEn` — pripoved ima **vseh 22** kadrov v obeh jezikih |
| `rezi.60` / `rezi.30` | `niz` ima **22** oziroma **10** rezov, `dolzina` 60 oziroma 30 s |
| `rezi.*.bit` | `bpm` 128,0, `utrip_ms` 468,8 in `utripovi` po kadrih (`k01: 7`, `k02: 4`, `k03: 3`, …) |
| `rezi.30.govorSl30` / `.govorEn30` in `rezi.60.govorEn60` | pripoved, vezana na rez in kader |
| `zakljucek` | blagovna, kraj, telefon, e-pošta, Booking, opis nastanitve |

Reža :60 zajema točno 128 utripov (32 taktov), reža :30 točno 64. Posnetek je zato 1800
oziroma 900 okvirjev (60/30 s × 30 fps).

## `zvok/` — pripoved, podlaga, masterji

- **Pripoved:** Piper, `sl_SI-artur-medium` (CC BY 4.0) in `en_GB-cori-high` (javna domena).
  `en_US-ryan-high` je **izrecno zavrnjen** — CC BY-**NC**-SA ne sme v komercialni spot.
- **Podlaga:** `Swale.ogg` (Ksd5, Wikimedia Commons, CC0) kot splošna zvočna voda in
  *Wholesome* (Kevin MacLeod, CC BY 4.0, ISRC `USUAN1900022`), izbrana zaradi izmerjenih
  128 BPM. Glasbene datoteke v repozitoriju ni — glej [Kaj namenoma ni v
  repozitoriju](#kaj-namenoma-ni-v-repozitoriju).
- **12 masterjev** `master-{60,30}-{sl,en}-{mojster,splet,druzbeno}.m4a`. Vsak ima v
  `namera-*.json` pod `izvozi.<namen>` cilj in **izmerjeno** vrednost; tabela je prepisana iz
  teh štirih datotek (2026-10-27), `odstopanje` je v vseh dvanajstih `null`:

| mojster | cilj I | izmerjeno I | izmerjen TP | izmerjen LRA |
|---|---|---|---|---|
| 60-sl mojster | −23 | −23,0 LUFS | −8,6 dBFS | 1,9 LU |
| 60-sl splet | −16 | −16,0 LUFS | −1,5 dBFS | 1,9 LU |
| 60-sl družbeno | −14 | −14,0 LUFS | −1,9 dBFS | 1,9 LU |
| 60-en mojster | −23 | −23,0 LUFS | −9,7 dBFS | 3,1 LU |
| 60-en splet | −16 | −16,0 LUFS | −2,7 dBFS | 3,1 LU |
| 60-en družbeno | −14 | −14,0 LUFS | −2,4 dBFS | 3,0 LU |
| 30-sl mojster | −23 | −23,0 LUFS | −9,1 dBFS | 1,9 LU |
| 30-sl splet | −16 | −16,0 LUFS | −2,1 dBFS | 1,9 LU |
| 30-sl družbeno | −14 | −14,0 LUFS | −2,0 dBFS | 1,7 LU |
| 30-en mojster | −23 | −23,0 LUFS | −9,2 dBFS | 2,0 LU |
| 30-en splet | −16 | −16,0 LUFS | −2,4 dBFS | 2,0 LU |
| 30-en družbeno | −14 | −14,0 LUFS | −2,2 dBFS | 1,9 LU |

  Cilj televizije je EBU R 128 (`I = −23 LUFS`, TP ≤ −1,5). Vrednosti so zapisane v isti
  datoteki, zato jih bralec preveri z `python -c` ali `ffprobe`, ne na besedo.
- **Četrti sloj (proceduralni FX):** `rka-efekti-naredi.py` sintetizira *kitlo* na prehodih,
  *udarec* na glavah poglavij in *dvig* pred zaključno kartico (seed `default_rng(1000 + i)`,
  brez tujih vzorcev). Namer so zapisane v `namera-*.json`.
  Dva pogoja, ki se ju ne da uganiti iz imena skripte:
  1. `rka-zvok.py` glasbeno podlago doda **šele z `--glasba=<datoteka>`** (`rka-zvok.py:15,
     473`); brez te zastavice dobiš masterje brez podlage in z drugo glasnostjo.
  2. `rka-efekti-mera.py` potrebuje `--podlaga=` **brez** efektov
     (`rka-efekti-mera.py:13`), sicer meri efekt proti samemu sebi in lažno javlja `SLABO`.

## Izvoženi izdelki

**14 izdelkov** iz **8 platn**. Tabela namenov je edina in stoji na dveh vrsticah
`rka-mux.py`: `TABELA` (vrstica 26) za ležeče in `TABELA_POKONCI` (vrstica 31) za pokončno:

| razmerje | jezik | nameni | število |
|---|---|---|---|
| 16×9 | sl | mojster, splet, družbeno | 6 (× 2 reži) |
| 16×9 | en | splet, družbeno | 4 (× 2 reži) |
| 9×16 | sl in en | samo družbeno | 4 (× 2 reži) |

Pokončna različica obstaja samo za družbeni tok: mojster in splet sta odobrena na ležečem
platnu, njuna navpična različica bi bil **nov izdelek**, ne kopija.

Izvožene MP4 datoteke živijo izven repozitorija (`..\rka-reklama\`), skupaj z varovano
kopijo pred živo plastjo (`_pred-gibom-2026-10-26\`) in piloti `_pilot-*.mp4`.

## Lokalni predogled

Pythonov `http.server` **ne zna odgovoriti s `206 Partial Content`**, brskalnik pa ga terja
za `<video>` in `<audio>` — predvajanje se zatakne in `load` nikoli ne sproži. Zato vse
postreže byte-range strežnik iz `orodja/`:

```bash
# stran in filmska stran (mapa in vrata sta argumenta, zato deluje tudi iz svežega klona)
node orodja/rka-streznik.cjs . 4183
#   http://127.0.0.1:4183/index.html
#   http://127.0.0.1:4183/zgodba.html
#   http://127.0.0.1:4183/zgodba.html?razmerje=9x16

# izdelki (izven repozitorija) + primerjalna stran
node orodja/rka-postrezi-predogled.cjs 4185     # http://127.0.0.1:4185/predogled.html

# slušalni A/B
python orodja/rka-ab-streznik.py 4188
```

Ostale skripte imajo **absolutne poti te stroja** — glej
[`orodja/`](#orodja--posnetek-instrumentov-in-njegove-meje).

## Cevovod: od besedila do MP4

Vsak korak sme teči šele, ko je njegov predhodnik izmerjen. Argumenti spodaj so prebrani iz
usage-vrstic samih skript:

```bash
# 1. pripoved po kadrih in konformacija oken (presteče čas razdeli na okna kadrov)
python orodja/rka-glas.py 60 sl --konformiraj

# 2. utripna mreža (128 BPM) in njen nadzor
python orodja/rka-ritem.py spot.json
python orodja/rka-ritem-list.py 60 128 --upisi
python orodja/rka-ritem-kontrola.py

# 3. miks in merjenje glasnosti (zapiše cilj IN izmerjeno vrednost)
python orodja/rka-zvok.py 60 sl --mojster --glasba=<pot-do-Wholesome.mp3>
python orodja/rka-efekti-naredi.py 60 sl
python orodja/rka-efekti-mera.py 60 sl --podlaga=<master-brez-FX>

# 4. podnapisi (.vtt) in njihova vrata
python orodja/rka-podnapisi.py

# 5. platno v MP4 (sliko jemlje brskalnik, zvoka se ne generira na novo)
node orodja/rka-render.cjs 60 --jezik=sl                    # 16x9
node orodja/rka-render.cjs 60 --jezik=sl --razmerje=9x16    # pokončno
#    Zamičnica --jpeg je hitrejši zajem in NI pot dobavljenih izdelkov: JPEG iz dekoderja
#    pride kot yuvj420p s polnim razponom. Encoder ga pretvori vse skupaj
#    (rka-render.cjs:224-228), vrata pa razpon zahtevajo posebej.

# 6. zlaganje platna + izmerjenega mojstra v izdelke (-c copy, platnu se ne zgodi nič)
python orodja/rka-mux.py --vse
python orodja/rka-mux.py 60 sl --namen=druzbeno

# 7. vrata
python orodja/rka-izvoz-preveri.py
node orodja/rka-klon-primerjava.cjs
```

Veriga vseh osmih platn (`orodja/rka-rezja-veriga.ps1`, zaganjalo `rka-rezja-zaganjalo.ps1`)
je zadnjič tekla 2026-10-26 od 20:37:53 do 2026-10-27 01:01:11 — **4 h 23 min** za 8 renderjev
in 9 prever. Posamezen render je trajal **982 do 3348 s** (najhitrejši 30-en-9x16,
najpočasnejši 60-en-16x9); številke so iz dnevnika verige `%TEMP%\rezja-dnevnik.txt` in so
strojno odvisne. V istem dnevniku je tudi padec, ki ga je veriga takrat doživela:
`zgodba-sonda` je vrnila kodo 2 (`panel se ni zavrtel do dna, ostalo 1 px`). Po popravilu
nestalnega zavrtja je sonda tekla dvakrat znova in obakrat javila »V REDU: vseh 272 meritev«;
njen falsifikator je `rka-zgodba-sonda-mutacija.py`.

## Vrata in njihov dokaz

Načelo: **vrata so verodostojna šele, ko smo videli, da padejo.** Vsaka vrata imajo svoj
falsifikator (`*mutacija.*`), ki namensko pokvari vir in zahteva, da pade **prav ta**
trditev; nato mora biti vrnjen bajtsko enak izvirnik. Številke v stolpcu *dokaz* so iz
tabel mutacij v samih skriptih, preštete strukturno (AST za Python, ujemanje oklepajev za
JS), zadnjič 2026-10-27.

| vrata | kaj trdijo | dokaz |
|---|---|---|
| `rka-drsenje-sonda.cjs` | matrika **5 zaslonov × 6 pregledov**, 4 trditve, dvojno vzorčena (30 kombinacij) | `rka-drsenje-mutacija.cjs` — 5 |
| `rka-zgodba-sonda.cjs` | 7 trditev o `zgodba.html` po vseh zaslonih, jezikih in obeh izvoznih oknih; **272 meritev** (zadnja dva zagona oba »V REDU«) | `rka-zgodba-mutacija.cjs` — 13 in `rka-zgodba-sonda-mutacija.py` — 1 (padlo 1, **NEZAJETO 1**) |
| `rka-gib-sonda.cjs` | **8 trditev** žive plasti: ROB, PORIV, PRESLIKAVA, KONC, UTRIP, DETERMINIZEM, ŽIVA STRAN, SMER | `rka-gib-mutacija.py` — 8 |
| `rka-pokonci-preveri.cjs` | 7 trditev pokončnega reza (uvoz prek parametra, živa stran nespremenjena, pas konstanten, napis na temnem polju …) | `rka-pokonci-mutacija.py` — 7 |
| `rka-izvoz-preveri.py` | vseh **14 izdelkov**: trajanje, 1920×1080 oziroma 1080×1920 @30, bt709 **in razpon `tv`, ne `pc`** (`rka-izvoz-preveri.py:156-162`), `moov` pred `mdat`, glasnost iz datoteke, črni okvirji sredi spota, da je dobavljen zvok bajtsko enak izmerjenemu mojstru (PCM md5) | `rka-izvoz-mutacija.py` — 6 |
| `rka-podnapisi-preveri.py` | podnapisi znotraj MP4 | `rka-podnapisi-mutacija.py` — 13 |
| `rka-podnapisi-strani-preveri.cjs` | 4 trditve o **štirih** `.vtt` (2 reži × 2 jezika) na `zgodba.html`; opt-in je dokazan tako, da izvoznik vrstice ne vidi | `rka-podnapisi-strani-mutacija.py` — 7 |
| `rka-ozadje-proveri.cjs` | YouTube uspel → lokalnega MP4 ni (strežnik šteje bajte); YouTube padel → rezervni MP4 se vrti | `rka-ozadje-mutacija.py` — 4 |
| `rka-deljena-preveri.py` | vsako polje JSON-LD in delitvene slike mora biti najdeno v kodi strani; dovoljeni sta dve skladni različici: *brez osnove* ali *z osnovo* | `rka-deljena-mutacija.py` — 19 skupnih + 3 samo-brez + 8 samo-z, torej **22 v stanju brez osnove in 27 v stanju z osnovo** |
| `rka-jezik-preveri.py` | jezikovna skladnost (sl/en) | `rka-jezik-mutacija.py` — 15 |
| `rka-slikovni-ab.py` | da je živa plast prišla **do pikslov**: 8 platn × 12 časovnih točk (96 parov) `blend=difference → signalstats YAVG` proti varovani kopiji, plus identitetske kontrole istega platna | `rka-slikovni-ab-mutacija.py` — 4 |
| `rka-ab-sonda.cjs` | 21 funkcionalnih prever slušalne A/B strani | `rka-ab-mutacija.py` — 7 |
| `rka-klon-primerjava.cjs` | delovna kopija je bajtsko enaka HEADu (SHA256 po `git ls-tree -r HEAD`; klon se pred primerjavo resetne na HEAD vira) | `rka-klon-mutacija.cjs` — 7 pogojev: na čistem drevesu izhodišče 0 → mutacija **1** (prav `zvok/60-sl/seznam.json`, izhod 1) → obnova 0 in izvirnik bajtsko enak |
| `rka-vednost-preveri.py` | nobena sled mutacij ne sme ostati v virih: izvirnik natanko enkrat, mutacija odsotna | — (to je **sama kontrola** falsifikatorjev) |
| `rka-bit-preveri.py` | reži se ujemata z utripno mapo | **NEZAJETO** — falsifikator ne obstaja |
| `rka-posnetki-proveri.py` | inventura posnetkov | **NEZAJETO** — falsifikator ne obstaja |
| `rka-svetlost.py` | luminanca slik | **NEZAJETO** — falsifikator ne obstaja |

Ukazi za zagon (iz korena repozitorija):

```bash
node orodja/rka-drsenje-sonda.cjs
node orodja/rka-zgodba-sonda.cjs
node orodja/rka-gib-sonda.cjs
python orodja/rka-izvoz-preveri.py          # RKA_IZVOZ=<mapa> preusmeri na drugo izvozno mapo
python orodja/rka-vednost-preveri.py
node orodja/rka-klon-primerjava.cjs
```

Pomembno pri merjenju: sonde same zaženejo statični strežnik na vratih **4194–4197** in
brezglavega Chrome na CDP vratih (**9411** izvoznik, **9451** gib-sonda). Med verigo sond
**ne zaganjajte drugega Chrome-a ali strežnika**: sonda išče prosta vrata 4194→4197 in jih
ne dobi, zato vrne `NI V REDU` — kar podre celotno verigo. Vsak zagon za seboj pusti
časovno označen `--user-data-dir`; zaklenjen profil da `EPERM` in tiho ne pove ničesar.

## `orodja/` — posnetek instrumentov in njegove meje

`orodja/` je **posnetek (snapshot) merilnih instrumentov**, ne prenosljiv gradbeni modul:

- Kopije so **nespremenjene** in vsebujejo absolutne poti te stroja
  (`C:\Users\admin\Downloads\sssdf\rka-onepage`, `…\rka-reklama`, `%TEMP%`).
  `manifest.json` za vsako od 79 datotek hrani SHA256, velikost in enovrstično vlogo.
- **Izvirniki živijo v `%TEMP%`.** Vsak popravek skripte zahteva ponoven zagon
  `node orodja/rka-orodja-kopiraj.cjs`, sicer trditev »enako bajtsko izvirniku« zastari.
  Uvoznik sam preveri SHA256 takoj po kopiranju in javi `brez vloge` / `vloga brez
  datoteke` / `izvzeti, ki jih ni v Tempu`; zadnji zagon 2026-10-27:
  `kopiranih: 79 | napak: 0 | brez vloge: 0 | vloga brez datoteke: 0`.
- **37 imen je zavrnjenih z razlogom**, med drugim `rka-meritve.cjs` (meri z
  `--window-size`, zato 1440×900 da pogled 805 px), `rka-pregled.cjs` in `rka-meri3.cjs`
  (samo trije pogledi namesto matrike 5 × 6), `rka-pv-zivjo-ubij.ps1` (ubija procese).
  Razlogi so v `manifest.json → izvzeto`; **teh skript ne uporabljajte za razsodbe.**
- `orodja/` **ne sme v javno namestitev strani**. Objavi se samo `index.html`,
  `zgodba.html`, `deljena.html`, `app.js`, `zgodba.js`, `*.css`, `assets/`, `fonts/`,
  `podnapisi/` in — če je treba — tiste datoteke iz `zvok/`, ki jih stran res kliče.
- `rka-vednost-preveri.py` bere `%TEMP%\rka-gib-mutacija.py`; na stroju brez teh izvirnikov
  ne more trditi ničesar.

Tri samokontrole pokrijejo celotno mapo brez vrzeli: 74 pregledanih = 34 `.cjs` + 39 `.py`
+ `manifest.json`, šest `.ps1` pa ima svoj parser — skupaj 80, nobena datoteka ne uide.
Vsaka sprejme cilj kot argument, zato jo lahko pognete tudi nad poskusno mapo:

```bash
node orodja/rka-orodja-sintaksa.cjs [mapa]   # node --check + py_compile + JSON
powershell -NoProfile -ExecutionPolicy Bypass -File orodja/rka-ps1-preveri.ps1 [mapa]
node orodja/rka-pred-objavo-scan.cjs [repo]  # 8 vzorcev skrivnosti po git drevesu
```

Vse tri so bile videne pasti na namensko pokvarjenih kopijah (2026-10-27 v `%TEMP%`, ne v
repozitoriju): sintaksa je javila `SINTAKSA NE` za pokvarjena `.cjs` in `.py`
(`pregledanih: 2 | sintakticnih napak: 2`), ps1-parser `PARSING FAILED` za nedokončan
niz (`parsing errors: 1`) in sken je na posajenem lažnem `ghp_` žetonu javil
`zadetkov: 1 | NI V REDU`. Pri vseh treh je izhodna koda izmerjena **brez cevi** — `$?`
za cevi je koda zadnjega `taila`, ne vrat; napačen cilj vrne 1, pravo drevo 0.

## Licence in navedbe

Podrobno in z merjenimi nivoji: **[`zvok/LICENCE.md`](zvok/LICENCE.md)**. Ob vsaki objavi je
obvezna navedba (pripoved je sintetična, zato je licenca govornega modela enako zavezujoča
kot licenca posnetka):

> Pripoved: Piper TTS, slovenski glas „Artur“ (Filip Pišlar, CC BY 4.0).
> Zvočna podlaga: „Swale“ (Ksd5, Wikimedia Commons, CC0).
> Glasba: „Wholesome“ (Kevin MacLeod, incompetech.com, CC BY 4.0).

Za angleško različico zadostuje »angleški glas: Piper, zbirka LibriVox (javna domena)«.
Pisavi (Cormorant Garamond, Manrope) sta pod SIL OFL — licence sta v `fonts/`. Vsi kadri in
fotografije so lastniški posnetki družine; tretjega gradiva in spletnih prevzemov ni.

## Kaj namenoma ni v repozitoriju

| kaj | kje je | zakaj |
|---|---|---|
| `zvok/glasba/` (*Wholesome*, 14 MB) | na disku, izven sledenja (`.gitignore`) | licenciran prevzem tretje osebe: CC BY dovoljuje rabo v izdelku, ne pa vsakega posrednika naprej skozi zgodovino repozitorija |
| `rka-reklama/` (~1,3 GB MP4) | sosednja mapa | produkt, ne vir; predelani kadri bi vsakič podvojili repozitorij |
| izvirniki skript v `%TEMP%` | `%TEMP%` | `orodja/` je kopija; izvirnik ostaja tisti, ki se ga dejansko zažene |

Posledica, ki jo je treba vedeti pred poskusom ponoviti gradnjo na drugem stroju:
**iz svežega klona cevovoda ni mogoče pognati do konca.** Manjkata glasbena podlaga
(`rka-zvok.py` brez `--glasba=` dela brez nje, z njo pa brez datoteke pade z
`NEDOSTAJA GLASBA`) in izvozna mapa, ki je ne vidi nobena vrata, dokler ji ne pove
`RKA_IZVOZ`.

## Odprte odločitve

Te so lastnikove, ne tehnične. V kodi so zato vidno **odprte**, ne rešene na pamet:

1. **Javni naslov strani (osnovni URL).** Mehanizem je zgrajen in dokazan (22 + 27
   mutacij); manjka samo vrednost:
   ```bash
   node orodja/rka-postavi-osnovo.cjs --base=https://… --zapisi
   python orodja/rka-deljena-preveri.py
   ```
   Ukaz brez `--zapisi` je suhi zagon in se datotek ne dotakne. Skripta sama pove, zakaj
   obstaja: javni URL se spreminja na **devetih mestih v dveh datotekah** (`og:image`,
   `twitter:image`, JSON-LD `image`, JSON-LD `url`, `og:url`, `canonical`) —
   `rka-postavi-osnovo.cjs:3-8`.
2. **Pospešena utripna karta** (en vdih pred `k22`). Nikoli ni bila odobrena. Poseže v okna
   v `spot.json`, zato pomeni ponovno konformacijo, novo regeneracijo FX, nov zvok in ponoven
   `rka-bit-preveri.py`.
3. **Vir hero-ozadja:** YouTube vdelava ali samostojno postrežen 720p zanka. Samostojno
   zahteva izvirni posnetek Kolpe od stranke (YouTube da le 360p).
4. **Obljuba »odgovorim v nekaj urah, tudi v soboto«.** Je storitveno zagotovilo lastnice in
   je **že zapečena v zaključne kartice vseh 14 izdelkov** — čiščenje samo na strani bi
   razsredilo stran in spot.
5. **Nove Facebook fotografije** (objavljene po 12. 10. 2026) — za prevzem je potrebna
   lastnikova prijava v brskalniku; v prijavna polja se ne tipka.
6. **Pravi posnetek Kolpe** od stranke, da se Ken Burns nadomesti z resničnim kadrom.

## Git: identiteta, konci vrstic, potis

- **Avtor commita je lastnik:** `robertpezdirc12-design`. Globalna identiteta te stroja je
  `clixad-agent`, zato vsak ukaz, ki ustvari commit, potrebuje par:
  ```bash
  git -c user.name='robertpezdirc12-design' \
      -c user.email='robertpezdirc12-design@users.noreply.github.com' commit -m '…'
  ```
  Enako velja za `--amend`; pred potisom preverite `git log -1 --pretty='%an <%ae>'`.
- **`.gitattributes` vsebuje `* -text`.** Del meritev primerja bajtsko vsebino datotek
  (`rka-izvoz-preveri.py` proti mojstru, `rka-klon-primerjava.cjs`), zato git ne sme
  pretvarjati koncev vrstic. Globalno je `core.autocrlf=true`; brez te atributa bi bil vsak
  checkout CRLF in vsaka primerjava bajtov bi lažala. Datoteke, dodane **pred** atributom,
  zahtevajo `git add --renormalize .` — navaden ponoven `add` ne stori ničesar, ker git
  pred razliko pogleda le velikost in čas datoteke in ju po predhodnem `add`-u že ujame.
- **Dokaz o klonu:** `node orodja/rka-klon-primerjava.cjs` (primerja SHA256 diska in klona,
  izpiše `preverjenih: N | razlicnih: 0`). Klon si naredi sam, če ga ni, in ga **vedno
  pripelje na HEAD vira** pred primerjavo — dokaz je bil popravljen prav zato, ker je
  obstoječi klon po vsakem commitu javljal razlike, ki jih v repozitoriju ni. Falsifikator
  `rka-klon-mutacija.cjs` preverja sedem pogojev in meri **prirast** razlik, ne absolutnega
  števila, zato deluje tudi na umazanem delovnem drevesu: na čistem je izhodišče
  `razlicnih: 0`, mutacija `zvok/60-sl/seznam.json` da `razlicnih: 1` z izhodno kodo 1,
  obnova vrne `razlicnih: 0`, izvirnik je bajtsko enak. Neodvisna mutacija (dodana vrstica
  v `podnapisi/rka-60-sl-splet.vtt`) je dala enako: natanko eno razliko. `git archive` za
  ta dokaz **ni veljaven**, ker pri izvozu sam pretvori končne znake.
- **Potis** na `robertpezdirc8-prog/riverkolpapartments` (javni repo) gre čez žeton za
  enkratno uporabo, tako da žeton ne pristane v ukazni vrstici, URL-u ali `.git/config`:
  ```bash
  GIT_ASKPASS="$TEMP/rka-gh-askpass.sh" GIT_TERMINAL_PROMPT=0 \
    git -c credential.helper= push origin main:main
  ```
  Po potisu preverite `git rev-list --count origin/main..HEAD` → **0** in
  `gh api repos/robertpezdirc8-prog/riverkolpapartments/commits/main --jq .sha`.
  `gh` CLI je na tej stroju prijavljen kot `robertpezdirc12-design`, ki ima na tem
  repozitoriju `pull: true, push: false` (izmerjeno 2026-10-27).

## Seznam pred predajo

1. `git status --porcelain` prazen; `git rev-list --count origin/main..HEAD` = 0.
2. `node orodja/rka-pred-objavo-scan.cjs` → `zadetkov: 0`.
3. `python orodja/rka-vednost-preveri.py` → `SKUPAJ slabih: 0`.
4. Vrata, ki jih prizadene zadnji poseg, ponovno zagnana — in njihov falsifikator.
5. `python orodja/rka-izvoz-preveri.py` → vseh 14 izdelkov V REDU.
6. `node orodja/rka-klon-primerjava.cjs` → `razlicnih: 0`.
7. Objava vsebuje navedbo iz `zvok/LICENCE.md` in **ne** vsebine `orodja/`.
8. Če se je spremenila katera koli skripta v `%TEMP%`: ponovno
   `node orodja/rka-orodja-kopiraj.cjs` in commit posodobljenega `manifest.json`.

## Kaj vrata ne vedo

Pošten seznam omejitev, da bralec ne računa na dokaz, ki ne obstaja:

- **Da na ozkem pogledu ne izgine vsebina, ni stvar vrat.** `styles.css` na
  `max-width:620px` skrije `.mnenje`, `.fakti`, `.smini` ter četrte in nadaljnje postavke
  seznamov. Merjeno je, da nič besedila ne štruri in da dokument ne drsi; da kateri od teh
  podatkov obstaja samo tam, ne preverja nič. **NEZAJETO.**
- **Čakanje na pisave v `rka-zgodba-sonda.cjs` je `NEZAJETO`:** samostojen zagon ima pisave
  že naložene, zato ni mogoče videti, da bi to varovanje padlo. Ostane zapisana omejitev, ne
  izmisljena trditev.
- **Brez falsifikatorja so tri vrata:** `rka-bit-preveri.py`, `rka-posnetki-proveri.py`,
  `rka-svetlost.py`. Njihove trditve so preverjene samo toliko, kolikor jih je preveril
  ročni pregled ob nastanku.
- **Klon-dokaz pozna samo sledene datoteke.** `rka-klon-primerjava.cjs` primerja
  `git ls-tree -r HEAD` z delovno kopijo: datoteke, ki niso sledene, ne more videti (izpiše
  jih samo na število), seznam razlik pa je odrezan pri 12 — in takrat to tudi reče.
- **Geometrijo izvoza sme brati samo `rka-izvoz-okvir.cjs` + `rka-izvoz-okvir.py`**
  (izriše okvir z `izris(t)` in ga primerja z istim okvirjem, izločenim iz MP4). Dve števili,
  ki sem ju nekoč izračunal iz CSS odstotkov, sta bili napačni.
- **Razpon barv je odvisen od zajema, ne od namena:** JPEG-pot je dala `yuvj420p(pc)` namesto
  `yuv420p(tv)` — na monitorju neprepoznavno, na televiziji narobe črna. Encoder jo danes
  pretvori (`rka-render.cjs:224-228`) in vrata to zahtevajo, a vsak hitrejši zajem mora biti
  ponovno preverjen zaradi zastavice razpona.
- **Učinka ni mogoče meriti proti končnemu mojstru:** `zvok/master-*.m4a` sta postala hkrati
  podlaga *in* efekt, zato `rka-efekti-mera.py` brez `--podlaga=` šteje dvakrat in lažno
  javlja `SLABO`.
- **Brskalnik ni priča prenesenim bajtom:** CDP in Resource Timing sta za predvajano lokalno
  zanko javila 0 KB. Priča je samo strežnik.
- **Meritev na telefonu tu ni bilo:** `--window-size` ne posnema mobilnega pogleda; za to je
  potreben CDP `Emulation.setDeviceMetricsOverride {mobile: true}`.
- **Izvoženih MP4-jev repozitorij ne vsebuje,** zato jih bralec presoja šele, ko požene
  `rka-izvoz-preveri.py` proti svoji izvozni mapi (`RKA_IZVOZ=…`).
