#!/usr/bin/env python3
# A/B stran za poslušanje: ista zaznamka, dva masterja (brez efektov / z efekti),
# preklop brez prekinitve predvajanja. Postavitve efektov so merjene iz razlike
# dveh miksov, ne iz domneve.
#
#   raba: python rka-ab-naredi.py    # potem python -m http.server 4188 --directory Temp/rka-ab
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json, os

SCRATCH = os.path.join(os.environ["TEMP"], "rka-ab")
meritve = json.load(open(os.path.join(SCRATCH, "meritve.json"), encoding="utf-8"))
enota = {"60": 60.0, "30": 30.0}
naziv = {"kitla": "kitla", "udarec": "udarec", "dvig": "dvig"}
# Casovni vrstni red ni okras: puščici gor/dol iščeta najbližji učinek po seznamu,
# razvrščen seznam pa je tudi tisti, ki ga bralec dejansko prebere.
for rows in meritve.values():
    rows.sort(key=lambda r: r["t"])

gumbi = "\n".join(
    f"<button class='rez{' aktiv' if r == '60' else ''}' data-rez='{r}' type='button'>:{r} s"
    f"</button>" for r in ("60", "30"))

tela = {}
for rez, rows in meritve.items():
    tela[rez] = "\n".join(
        f"<tr data-t='{r['t']:.3f}' tabindex='0'><td class='cas'>{r['t']:.2f}</td>"
        f"<td>{r['kader']}</td>"
        f"<td class='v {r['vrsta']}'>{naziv[r['vrsta']]}"
        f"{' · pod pripovedjo' if r['pod_govorom'] else ''}</td>"
        f"<td class='n'>{r['ucinek']:.1f}</td><td class='n'>{r['podlaga']:.1f}</td>"
        f"<td class='n raz'>{r['razlika']:+.1f}</td></tr>" for r in rows)

stran = f"""<!doctype html>
<html lang="sl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>A/B učinki — reklama Kolpa</title>
<link rel="icon" href="data:,">
<style>
:root {{ --scina:#12161a; --plosc:#1b2127; --crta:#2c343c; --besedilo:#e8edf1;
  --slabese:#93a1ad; --kitla:#4fa3c7; --udarec:#e0713f; --dvig:#8bbf5a; }}
* {{ box-sizing:border-box }}
body {{ margin:0; background:var(--scina); color:var(--besedilo);
  font:16px/1.45 "Segoe UI",system-ui,sans-serif }}
main {{ display:block; max-width:900px; margin:0 auto; padding:22px 18px 40px }}
h1 {{ font-size:19px; margin:0 0 4px; font-weight:600; letter-spacing:.01em }}
.uvod {{ margin:0 0 20px; color:var(--slabese); font-size:14px }}
.vrha {{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:16px }}
.seg, .rezi {{ display:flex; border:1px solid var(--crta); border-radius:10px;
  overflow:hidden }}
button {{ font:inherit; color:var(--slabese); background:var(--plosc);
  border:0; padding:9px 16px; cursor:pointer }}
.seg button + button, .rezi button + button {{ border-left:1px solid var(--crta) }}
.rezi button {{ border-radius:0 }}
button:focus-visible {{ outline:2px solid var(--kitla); outline-offset:2px }}
.seg button[aria-pressed="true"], .rezi button.aktiv {{ background:#243138;
  color:var(--besedilo); font-weight:600 }}
.ask {{ display:flex; gap:14px; align-items:center; margin-bottom:10px }}
.ask button {{ border:1px solid var(--crta); border-radius:8px; color:var(--besedilo);
  min-width:104px }}
.kc {{ font-variant-numeric:tabular-nums; color:var(--slabese); font-size:14px;
  min-width:52px }}
.cs {{ flex:1; height:6px; background:var(--crta); border-radius:3px; position:relative;
  cursor:pointer }}
.cs i {{ position:absolute; top:0; bottom:0; left:0; width:0; background:var(--kitla);
  border-radius:3px; display:block }}
.ura {{ position:relative; height:44px; margin:6px 0 8px; background:var(--plosc);
  border:1px solid var(--crta); border-radius:8px }}
.ura b {{ position:absolute; top:6px; bottom:14px; width:2px; background:var(--kitla);
  cursor:pointer }}
.ura b::after {{ content:""; position:absolute; left:-4px; right:-4px; top:0; bottom:0 }}
.ura b.udarec {{ background:var(--udarec); width:3px }}
.ura b.dvig {{ background:var(--dvig) }}
.ura .merka {{ position:absolute; bottom:2px; font:11px/1 "Segoe UI",sans-serif;
  color:var(--slabese); font-variant-numeric:tabular-nums }}
.ura .kaz {{ position:absolute; top:0; bottom:14px; width:1px; background:#fff;
  pointer-events:none }}
.legenda {{ display:flex; gap:18px; font-size:13px; color:var(--slabese);
  margin:0 0 18px; flex-wrap:wrap }}
.legenda span::before {{ content:""; display:inline-block; width:9px; height:9px;
  border-radius:2px; margin-right:6px; background:var(--kitla) }}
.legenda span.udarec::before {{ background:var(--udarec) }}
.legenda span.dvig::before {{ background:var(--dvig) }}
.legenda span.namig::before {{ content:none }}
.tabela {{ width:100%; border-collapse:collapse; font-size:14px }}
th {{ text-align:left; color:var(--slabese); font-weight:500; font-size:12px;
  padding:6px 8px; border-bottom:1px solid var(--crta) }}
td {{ padding:6px 8px; border-bottom:1px solid #212830 }}
tr:hover, tr.aktiv {{ background:#20272e }}
tr[data-t] {{ cursor:pointer }}
tr[data-t]:focus-visible {{ outline:2px solid var(--kitla); outline-offset:-2px }}
.cas {{ font-variant-numeric:tabular-nums; color:var(--slabese) }}
.v.kitla {{ color:var(--kitla) }} .v.udarec {{ color:var(--udarec) }}
.v.dvig {{ color:var(--dvig) }}
.n {{ font-variant-numeric:tabular-nums; text-align:right }}
th.n {{ text-align:right }}
.opombe {{ display:block; margin-top:20px; font-size:13px; color:var(--slabese) }}
.skrito {{ position:absolute; width:1px; height:1px; margin:-1px; padding:0;
  overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0 }}
kbd {{ background:var(--plosc); border:1px solid var(--crta); border-radius:4px;
  padding:1px 6px; font:12px ui-monospace,Consolas,monospace }}
@media (max-width:560px) {{ .ura b {{ top:2px; bottom:2px }} h1 {{ font-size:17px }} }}
@media (prefers-reduced-motion:reduce) {{ * {{ transition:none !important }} }}
</style></head>
<body><main>
<h1>Učinki na rezih — A/B</h1>
<p class=uvod>Ista slika, isti glas, ista glasba. Razlika je samo četrti sloj:
kitle na prehodih, udarci na menjavah poglavij in dvig pred zaključno kartico.</p>

<div class=vrha>
  <div class=seg role=group aria-label="Različica">
    <button id=ga type=button aria-pressed=false>A · brez učinkov</button>
    <button id=gb type=button aria-pressed=true>B · z učinki</button>
  </div>
  <div class=rezi role=group aria-label="Trajanje spota">{gumbi}</div>
</div>

<div class=ask>
  <button id=predvajaj type=button>Predvajaj</button>
  <samp class=kc id=kc>0.00</samp>
  <div class=cs id=cs role=slider aria-label="Položaj predvajanja"
       tabindex=0 aria-valuemin=0 aria-valuenow=0><i id=ov></i></div>
</div>

<div class=ura id=ura></div>
<div class=legenda><span>kitla</span><span class=udarec>udarec</span>
  <span class=dvig>dvig</span>
  <span class=namig style="margin-left:auto">klik na znak ali vrstico skoči tja</span></div>

<table class=tabela><caption class=skrito>Učinki na uri, izmerjeni iz razlike dveh miksov</caption>
  <thead><tr><th scope=col>čas</th><th scope=col>kader</th><th scope=col>učinek</th>
  <th class=n scope=col>vrh učinka dBFS</th><th class=n scope=col>vrh podlage dBFS</th>
  <th class=n scope=col>razlika dB</th>
  </tr></thead><tbody id=telo>{tela['60']}</tbody></table>

<footer class=opombe>
  <kbd>presledek</kbd> predvajaj · <kbd>x</kbd> preklop A/B · <kbd>←</kbd> <kbd>→</kbd>
  za sekondo · <kbd>↑</kbd> <kbd>↓</kbd> prejšnji ali naslednji učinek.
  <br>Podlaga reke, glasba in pripoved so nespremenjene. Ta stran je dokaz
  odločitve, ne trenutnega stanja: različica A je bil odobren spletni master
  (<samp>master-60-sl-splet.m4a</samp> in <samp>master-30-sl-splet.m4a</samp>),
  različica B je iz istega miksa, dopolnjena s četrtim slojem.
  <br><b>26. 10. 2026</b> je bila odločitev sprejeta za B: različica B je od
  tedaj zapisani spletni master, različica A je shranjena samo še kot primerjava
  v <samp>Temp/rka-zvok-stari/</samp>.
  <br>Meritev: odštejem dva miksa, ki se razlikujeta samo v učinkih (48 kHz), in
  v istem 400 ms oknu primerjam vrh učinka z vrhom podlage.
</footer>
<audio id=zvok preload=auto src="B-60-sl.m4a"></audio>
</main>
<script>
const E = {json.dumps(enota)};
const M = {json.dumps(meritve, ensure_ascii=False)};
const z = document.getElementById("zvok"), ov = document.getElementById("ov"),
      kc = document.getElementById("kc"), ura = document.getElementById("ura"),
      telo = document.getElementById("telo"), cs = document.getElementById("cs"),
      ga = document.getElementById("ga"), gb = document.getElementById("gb"),
      gumbP = document.getElementById("predvajaj");
let stanje = {{ dat: "B", rez: "60" }};

function natisniUro() {{
  ura.textContent = "";
  for (const r of M[stanje.rez]) {{
    const b = document.createElement("b");
    b.className = r.vrsta;
    b.dataset.t = r.t.toFixed(3);
    b.style.left = (100 * r.t / E[stanje.rez]).toFixed(3) + "%";
    b.title = r.kader + " · " + r.vrsta + " · " + r.t.toFixed(2) + " s";
    ura.appendChild(b);
  }}
  const korak = E[stanje.rez] >= 60 ? 10 : 5;
  for (let t = 0; t <= E[stanje.rez]; t += korak) {{
    const m = document.createElement("span");
    m.className = "merka";
    m.textContent = t;
    if (t === 0) m.style.left = "4px";
    else if (t >= E[stanje.rez]) m.style.right = "4px";
    else {{ m.style.left = (100 * t / E[stanje.rez]).toFixed(3) + "%";
            m.style.transform = "translateX(-50%)"; }}
    ura.appendChild(m);
  }}
  const k = document.createElement("span");
  k.className = "kaz"; k.id = "kazalec"; ura.appendChild(k);
}}
function skoci(t) {{
  prestavi(Math.max(0, t - 1.0));
  if (z.paused) z.play();
}}
// Iskanje v nalozenem, a se ne do konca prenesenem posnetku razveljavi brez
// metametadata, zato gre preklopolnik cez isto predmetno pot.
function prestavi(t) {{
  if (z.readyState >= 1) z.currentTime = t;
  else z.addEventListener("loadedmetadata", () => {{ z.currentTime = t; }}, {{ once: true }});
}}
// Vir je odvisen od obeh stikal (A/B in :60/:30). Nova dolzina ima svojo
// casovnico, zato zacne na nuli; preklop A/B obdrzi trenutni polozaj.
function nastaviVir(ciljCas) {{
  const pot = stanje.dat + "-" + stanje.rez + "-sl.m4a";
  const zivi = !z.paused;
  const zazeni = () => {{ z.currentTime = ciljCas; if (zivi) z.play(); }};
  if (z.getAttribute("src") !== pot) {{
    z.src = pot;
    if (z.readyState >= 1) zazeni();
    else z.addEventListener("loadedmetadata", zazeni, {{ once: true }});
  }} else {{
    z.currentTime = ciljCas;
    if (zivi) z.play();
  }}
}}
function postaviRez(r) {{
  stanje.rez = r;
  telo.innerHTML = M[r].map(x =>
    "<tr data-t='" + x.t.toFixed(3) + "' tabindex='0'>" +
    "<td class='cas'>" + x.t.toFixed(2) + "</td><td>" + x.kader + "</td>" +
    "<td class='v " + x.vrsta + "'>" + x.vrsta + (x.pod_govorom ? " · pod pripovedjo" : "") +
    "</td><td class='n'>" + x.ucinek.toFixed(1) + "</td><td class='n'>" +
    x.podlaga.toFixed(1) + "</td><td class='n raz'>" +
    (x.razlika > 0 ? "+" : "") + x.razlika.toFixed(1) + "</td></tr>").join("");
  document.querySelectorAll(".rez").forEach(g =>
    g.classList.toggle("aktiv", g.dataset.rez === r));
  natisniUro();
  cs.setAttribute("aria-valuemax", String(E[r]));
  nastaviVir(0);
}}
function preklop(dat) {{
  const t = z.currentTime;
  stanje.dat = dat;
  ga.setAttribute("aria-pressed", String(dat === "A"));
  gb.setAttribute("aria-pressed", String(dat === "B"));
  nastaviVir(t);
}}
ga.addEventListener("click", () => preklop("A"));
gb.addEventListener("click", () => preklop("B"));
gumbP.addEventListener("click", () => z.paused ? z.play() : z.pause());
z.addEventListener("play", () => gumbP.textContent = "Ustavi");
z.addEventListener("pause", () => gumbP.textContent = "Predvajaj");
cs.addEventListener("click", ev => {{
  const r = cs.getBoundingClientRect();
  prestavi(E[stanje.rez] * (ev.clientX - r.left) / r.width);
}});
telo.addEventListener("click", ev => {{
  const vr = ev.target.closest("tr[data-t]");
  if (vr) skoci(+vr.dataset.t);
}});
ura.addEventListener("click", ev => {{
  const b = ev.target.closest("b[data-t]");
  if (b) skoci(+b.dataset.t);
}});
telo.addEventListener("keydown", ev => {{
  if (ev.key === "Enter" || ev.key === " ") {{
    const vr = ev.target.closest("tr[data-t]");
    if (vr) {{ ev.preventDefault(); skoci(+vr.dataset.t); }}
  }}
}});
document.querySelectorAll(".rez").forEach(g =>
  g.addEventListener("click", () => postaviRez(g.dataset.rez)));
window.addEventListener("keydown", ev => {{
  const v = ev.target;
  if (ev.key === " ") {{
    if (v !== document.body) return;          // prostor ze aktivira fokusiran element
    ev.preventDefault(); z.paused ? z.play() : z.pause();
  }}
  else if (ev.key === "x") preklop(stanje.dat === "A" ? "B" : "A");
  else if (ev.key === "ArrowRight") prestavi(Math.min(E[stanje.rez] - .05,
    z.currentTime + 1));
  else if (ev.key === "ArrowLeft") prestavi(Math.max(0, z.currentTime - 1));
  else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {{
    ev.preventDefault();
    const s = M[stanje.rez], naprej = ev.key === "ArrowDown";
    const najdena = naprej ? s.find(r => r.t > z.currentTime + .2)
                           : s.slice().reverse().find(r => r.t < z.currentTime - .2);
    if (najdena) skoci(najdena.t);
  }}
}});
(function tick() {{
  const d = E[stanje.rez], t = z.currentTime || 0;
  const delez = 100 * t / d;
  ov.style.width = delez.toFixed(2) + "%";
  kc.textContent = t.toFixed(2);
  cs.setAttribute("aria-valuenow", t.toFixed(2));
  const k = document.getElementById("kazalec");
  if (k) k.style.left = delez.toFixed(2) + "%";
  let aktivna = null;
  for (const r of M[stanje.rez]) if (r.t <= t + .05) aktivna = r.t.toFixed(3);
  telo.querySelectorAll("tr").forEach(vr =>
    vr.classList.toggle("aktiv", vr.dataset.t === aktivna));
  requestAnimationFrame(tick);
}})();
postaviRez("60");
</script>
</body></html>
"""
pot = os.path.join(SCRATCH, "index.html")
open(pot, "w", encoding="utf-8").write(stran)
print(f"zapisano {pot}  ({len(stran)} znakov, {sum(len(v) for v in meritve.values())} vrst)")
