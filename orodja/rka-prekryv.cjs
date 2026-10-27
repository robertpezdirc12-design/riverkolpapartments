/* Detektor prekrivanja: poišče pare vidnih elementov, ki se med seboj prekrivajo,
   in pove, koliko katera veja potrebuje višine. Zunanje orodje. */
const { spawn } = require("child_process");
const fs = require("fs");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = "C:\\Users\\admin\\AppData\\Local\\Temp\\rka-shot";
const PORT = 9405;
const wait = ms => new Promise(r => setTimeout(r, ms));
const ZASLONI = [
  { ime: "telefon", w: 390, h: 844, dpr: 3, mobil: true },
  { ime: "s23u", w: 338, h: 731, dpr: 3, mobil: true }
];
const POGLEDI = ["h70", "h30b", "domov", "reka", "termini", "galerija"];

(async () => {
  fs.rmSync(`${process.env.TEMP}\\cdp-prek`, { recursive: true, force: true });
  const chrome = spawn(CHROME, ["--headless=new","--disable-gpu","--hide-scrollbars",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}\\cdp-prek`,
    "--no-first-run","--window-size=1500,1000","about:blank"], { stdio:"ignore" });
  let v; for (let i=0;i<40;i++){ try{ v=await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break;}catch{await wait(400);} }
  if (!v) throw new Error("Chrome se ni zagnal");
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener("open",r));
  let n=0; const p=new Map();
  const send=(m,pr={},sid)=>new Promise((res,rej)=>{const id=++n;p.set(id,{res,rej});
    ws.send(JSON.stringify(sid?{id,method:m,params:pr,sessionId:sid}:{id,method:m,params:pr}));});
  ws.addEventListener("message",ev=>{const m=JSON.parse(ev.data);
    if(m.id&&p.has(m.id)){const q=p.get(m.id);p.delete(m.id);m.error?q.rej(new Error(JSON.stringify(m.error))):q.res(m.result);}});
  const {targetId}=await send("Target.createTarget",{url:"about:blank"});
  const {sessionId}=await send("Target.attachToTarget",{targetId,flatten:true});
  const sess=(m,pr={})=>send(m,pr,sessionId);
  const ev=async ex=>{const r=await sess("Runtime.evaluate",{expression:ex,returnByValue:true});
    if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description||r.exceptionDetails));
    return r.result.value;};
  await sess("Page.enable"); await sess("Runtime.enable");

  const EX = `(() => {
    const s=document.getElementById('stage');
    const pot = el => {const d=[];let c=el;while(c&&c!==s){const i=[...c.parentElement.children].indexOf(c);
      d.unshift(String(c.className||c.tagName).trim().split(/\\s+/)[0]+'['+i+']');c=c.parentElement;}
      return d.slice(-3).join('>');};
    const vid=el=>{const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
      return r.width>8&&r.height>8&&cs.display!=='none'&&cs.visibility!=='hidden'&&cs.position!=='fixed';};
    /* Dejansko izrisano območje: pravokotnik, ostrižan ob vsakem predniku z
       overflow != visible, pomnožen z dedno prosojnostjo. Brez tega detektor
       javlja figure z opacity:0 in reze, ki jih gumb ostriže. */
    const izris=el=>{
      let r=el.getBoundingClientRect(), o=1, c=el;
      while(c&&c!==s){
        const cs=getComputedStyle(c);
        o*=+cs.opacity;
        if(cs.overflowX!=='visible'||cs.overflowY!=='visible'){
          const p=c.getBoundingClientRect();
          r={left:Math.max(r.left,p.left),top:Math.max(r.top,p.top),
             right:Math.min(r.right,p.right),bottom:Math.min(r.bottom,p.bottom)};
        }
        c=c.parentElement;
      }
      if(c!==s&&el!==s){const cs=getComputedStyle(s);
        if(cs.overflowX!=='visible'||cs.overflowY!=='visible'){
          const p=s.getBoundingClientRect();
          r={left:Math.max(r.left,p.left),top:Math.max(r.top,p.top),
             right:Math.min(r.right,p.right),bottom:Math.min(r.bottom,p.bottom)};
        }}
      return {r,o,vid:r.right-r.left>8&&r.bottom-r.top>8&&o>.05};
    };
    /* 1. Staršev paket: element, ki štruri iz starševega pravokotnika, medtem ko
          starš ne reže (overflow:visible) — to je mehanizem te napake. */
    const ssturajoci=[...s.querySelectorAll('*')].filter(el=>{
      const p=el.parentElement; if(!p||p===s||!vid(el)||!vid(p)) return false;
      if(getComputedStyle(p).overflow!=='visible') return false;
      if(getComputedStyle(el).position==='absolute') return false;
      const a=el.getBoundingClientRect(), b=p.getBoundingClientRect();
      return a.top<b.top-8||a.bottom>b.bottom+8||a.left<b.left-8||a.right>b.right+8;
    }).map(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();
      const stran=a.top<b.top-4?'gor za '+Math.round(b.top-a.top)+'px'
        :a.bottom>b.bottom+4?'dol za '+Math.round(a.bottom-b.bottom)+'px'
        :a.left<b.left-4?'levo':'desno';
      return pot(el)+' '+stran;});
    /* 2. Prekrivanje listov iz različnih poddrev — po dejanskem izrisu. */
    const listni=[...s.querySelectorAll('*')].filter(el=>{
      if(!vid(el)) return false;
      const i=izris(el); if(!i.vid) return false;
      return !el.matches('.mreza figcaption, .smini figcaption');
    });
    const prekrivajoci=[];
    for(let i=0;i<listni.length;i++)for(let j=i+1;j<listni.length;j++){
      const A=listni[i],B=listni[j];
      if(A.contains(B)||B.contains(A)) continue;
      if(A.closest('[data-foto]')===B.closest('[data-foto]')) continue;
      const a=izris(A), b=izris(B);
      if(!a.vid||!b.vid) continue;
      const ra=a.r, rb=b.r;
      const x=Math.max(0,Math.min(ra.right,rb.right)-Math.max(ra.left,rb.left));
      const y=Math.max(0,Math.min(ra.bottom,rb.bottom)-Math.max(ra.top,rb.top));
      if(x>6&&y>6) prekrivajoci.push(pot(A)+' <-> '+pot(B)+' ('+Math.round(x)+'x'+Math.round(y)+'px)');
    }
    const sb=s.getBoundingClientRect();
    const ven=s.firstElementChild;
    const otroci=[...ven.children].map(c=>{const r=c.getBoundingClientRect();
      return pot(c).split('>').pop()+' '+Math.round(r.height)+'px [\\u00b7'+Math.round(r.top-sb.top)+'..'+Math.round(r.bottom-sb.top)+']';});
    return JSON.stringify({gostota:getComputedStyle(document.documentElement).getPropertyValue('--g').trim(),
      stageH:Math.round(sb.height), otroci,
      ssturanje:[...new Set(ssturajoci)].slice(0,6),
      prekrivanji:[...new Set(prekrivajoci)].slice(0,6)});
  })()`;

  for (const z of ZASLONI) {
    await sess("Emulation.setDeviceMetricsOverride",{width:z.w,height:z.h,deviceScaleFactor:z.dpr,mobile:z.mobil});
    for (const pg of POGLEDI) {
      await sess("Page.navigate",{url:`http://127.0.0.1:4183/index.html#${pg}`});
      for(let i=0;i<60;i++){ if(await ev("document.documentElement.classList.contains('pripravljen')")) break; await wait(120);}
      await wait(1500);
      const m = JSON.parse(await ev(EX));
      const slabi = m.prekrivanji.length || m.ssturanje.length;
      console.log(`\n${slabi?"!!":"  "} ${z.ime} ${z.w}x${z.h}  ${pg}  g=${m.gostota} stage=${m.stageH}`);
      console.log("     otroci:", m.otroci.join(" | "));
      if (m.ssturanje.length) console.log("     STURI:", m.ssturanje.join("; "));
      if (m.prekrivanji.length) console.log("     PREKRIVANJE:", m.prekrivanji.join("; "));
    }
  }
  ws.close(); chrome.kill();
})().catch(e=>{console.error("NAPAKA:",e.message);process.exit(1);});
