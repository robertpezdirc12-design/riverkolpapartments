# Zvok reklame — licence in navedbe

Te reklame ni smelo javno objaviti brez tega dokumenta. Pripoved je
sintetična, zato je licenca govornega modela enako obvezna kot licenca
posnetka.

## Pripoved

**Slovenščina — uporabna.**
Piper `sl_SI-artur-medium` (VITS, 22 050 Hz → 48 kHz). Model je naučil
Filip Pišlar ([@ppisljar](https://github.com/ppisljar)) na zbirki
[Artur studio TTS](https://huggingface.co/datasets/ppisljar/artur_studio_tts),
licenca [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Komercialna raba je dovoljena, zahteva pa navedbo vira.

**Angleščina — prvotni glas ni uporaben.**
`en_US-ryan-high` je naučen na zbirki RyanSpeech (Kaggle, `roholazandie`) pod
licenco **CC BY-NC-SA 4.0**. Pripona *NC* pomeni, da komercialna raba ni
dovoljena, reklama pa je komercialna raba — zato tega glasu v izdelku ne
sme biti. Nadomestek je `en_GB-cori-high`, naučen na zbirki LibriVox, ki je
**javne domene**: navedba ni zahtevana, raba je prosta.

## Zvočna podlaga

`Swale.ogg` — posnetek tekoče reke, 31,0 s, 48 kHz mono, avtor Ksd5,
[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Swale.ogg),
licenca **CC0** (javna domena, navedba ni zahtevana).
To ni dobesedni posnetek Kolpe: uporabljen je kot splošna podlaga vode, da
pripoved ne stoji nad tišino.

## Glasbena podlaga

**Wholesome** — Kevin MacLeod, 2019, ISRC `USUAN1900022` (zapisan v samem
datotečnem značku), prejeto z [incompetech.com](https://incompetech.com).
Licenca **CC BY 4.0**: brezplačna tudi za komercialno rabo, zahteva pa navedbo
avtorja. Skladba traja 363,8 s; iz nje se v spotu uporabi prvih 60 s.

Izbrana je zaradi tempa: 128 BPM, kar sem potrdil z meritvijo (`rka-ritem.py`,
zaklad mreže 4,01). Pri 128 BPM je ena minuta točno 128 utripov oziroma 32
taktov, zato je cel časovni list razporejen po utripih in vsak rez pade na
utrip. Prvi utrip skladbe zamika 0,254 s, kar se pri mešanju odšteje, da sovpada
z začetkom kadra.

Referenčni poskus **Life of Riley** (isti avtor, ista licenca, 102 BPM) ni
izbran: pri 102 BPM se mreža ne ujema z minuto, zato reži ne morejo slediti
ritmu.

## Posnetki in fotografije

Vsi kadri so lastniški posnetki družine (Kolpa, Griblje, apartmaji).
Ni tretjega gradiva in ni posnetkov, shranjenih s spletnih strani drugih.

## Glasnost

| namen | cilj |
|---|---|
| televizija (mojster) | I = −23 LUFS, TP = −1,5 dBTP, LRA 11 (EBU R 128) |
| splet | I = −16 LUFS, TP = −1,5 dBTP |

Rečna podlaga (*Swale*) je pod pripovedjo dušena z razmerjem 8:1 in sprostitvijo
500 ms. Glasbena podlaga je na −20 LUFS pred dušenjem; izmerjeno na posnetem
miksu: sama −20,25 LUFS, dušena −22,07 LUFS, pripoved −15,66 LUFS, torej
**6,4 dB pod govorom** pri globini dušenja 1,8 dB. Glasnejše ne pride v poštev:
med pripovedjo je v spotu največ en sekunda premora, zato dušenje podlago tako
ali tako drži pod pragom zaznavnosti. Izmera vsakega mojstra je shranjena v
`zvok/namera-*.json`.

## Navedba ob objavi

Za opis videa ali nogo strani zadostuje:

> Pripoved: Piper TTS, slovenski glas „Artur“ (Filip Pišlar, CC BY 4.0).
> Zvočna podlaga: „Swale“ (Ksd5, Wikimedia Commons, CC0).
> Glasba: „Wholesome“ (Kevin MacLeod, incompetech.com, CC BY 4.0).

Angleška različica je na glasu Cori, zato zanjo zadostuje navedba
„angleški glas: Piper, zbirka LibriVox (javna domena)"; ker gre za javno
domeno, navedba ni pravna obveznost, ampak vljudnost. Izmerjene zvočne datoteke so
`master-{60,30}-{sl,en}-{mojster,splet,druzbeno}.m4a` — **dvanajst**, vsaka izmerjena iz
same datoteke, meritve v `namera-{60,30}-{sl,en}.json`. Od njih se v video izdelke
vgradi **enajst**: `rka-mux.py:26` za angleščino ne pozna namena *mojster*, zato
`master-60-en-mojster.m4a` in `master-30-en-mojster.m4a` ostaneta izmerjena, a ne
dobavljena. Izdelkov je **štirinajst**, ker družbeni zvok postreže tudi pokončnim platnom
(`rka-mux.py:31`). Nobena od teh datotek ne sme biti objavljena brez tega dokumenta.
