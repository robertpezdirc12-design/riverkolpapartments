/* Posnetek zaslona strani za primerjavo živega sloja + zajem napak v njej.
   Številke na strani so iz rka-slikovni-ab.py; ta zahod ne meri ničesar novega,
   samo dokaže, da se stran odpre brez izjeme in da video elementi dejansko
   naložijo glavo (duration > 0), sicer bi mu predvajalnik pokazal prazno okno. */
const { spawn } = require("child_process");
const fs = require("fs");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9443, wait = ms => new Promise(r => setTimeout(r, ms));
const NASLOV = "http://127.0.0.1:4185/primerjava-zivjo.html";

(async () => {
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}\\cdp-zivjo-${Date.now()}`,
    "--no-first-run", "--window-size=1400,1600", "about:blank"], { stdio: "ignore" });
  let v;
  for (let i = 0; i < 40; i++) {
    try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await wait(400); }
  }
  if (!v) throw new Error("Chrome se ni zagnal na portu " + PORT);
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
  const izjeme = [];
  ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.method === "Runtime.exceptionThrown")
      izjeme.push(String(m.params.exceptionDetails.exception?.description || m.params.text).split("\n")[0]);
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error")
      izjeme.push("log: " + String(m.params.entry.text).split("\n")[0]);
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const sess = (m, pr = {}) => send(m, pr, sessionId);
  const ev = async ex => {
    const r = await sess("Runtime.evaluate", { expression: ex, returnByValue: true });
    if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description || r.exceptionDetails));
    return r.result.value;
  };
  await sess("Page.enable"); await sess("Runtime.enable"); await sess("Log.enable");
  await sess("Emulation.setDeviceMetricsOverride", { width: 1400, height: 1600, deviceScaleFactor: 1, mobile: false });
  await sess("Page.navigate", { url: NASLOV });
  for (let i = 0; i < 100; i++) {
    if (await ev("document.readyState === 'complete' && document.querySelectorAll('video').length === 6")) break;
    await wait(200);
  }
  /* Počaka, da vsak video sporoči trajanje; brez tega je screenshot črno okno in
     ne dokazuje ničesar. */
  let meta = null;
  for (let i = 0; i < 60; i++) {
    meta = await ev(`Array.from(document.querySelectorAll('video')).map(v => ({
      id: v.className, src: v.currentSrc.split('/').pop(), nalozeno: v.readyState,
      dolzina: isFinite(v.duration) ? Math.round(v.duration * 100) / 100 : -1 }))`);
    if (meta.every(m => m.nalozeno >= 1 && m.dolzina > 0)) break;
    await wait(500);
  }
  console.log("videi: " + meta.map(m => `${m.src} ready=${m.nalozeno} dolzina=${m.dolzina}`).join(" | "));
  const gumbi = await ev(`document.querySelectorAll('button').length`);
  const pritisni = await ev(`(() => {
    const sk = document.querySelectorAll('.skupina')[0];
    sk.querySelector('.g-pred').click();
    sk.querySelector('.g-drsnik').value = '12';
    sk.querySelector('.g-drsnik').dispatchEvent(new Event('input'));
    const a = sk.querySelector('.g-a'), b = sk.querySelector('.g-b');
    return { a: Math.round(a.currentTime * 100) / 100, b: Math.round(b.currentTime * 100) / 100,
             oba_ista: Math.abs(a.currentTime - b.currentTime) < 0.11, ura: sk.querySelector('.g-ura').textContent };
  })()`);
  console.log(`gumbov: ${gumbi} · po simulaciji: a=${pritisni.a} s b=${pritisni.b} s · par na isti uri: ${pritisni.oba_ista} · oznka ${pritisni.ura}`);
  await wait(1200);
  const s = await sess("Page.captureScreenshot", { format: "png" });
  const pot = `${process.env.TEMP}\\rka-zivjo-primerjava.png`;
  fs.writeFileSync(pot, Buffer.from(s.data, "base64"));
  console.log("posnetek: " + pot);
  console.log(izjeme.length ? "IZJEME V STRANI (" + izjeme.length + "): " + izjeme.slice(0, 4).join(" || ")
                            : "IZJEME V STRANI: 0");
  ws.close(); chrome.kill();
  process.exit(0);
})().catch(e => { console.error("SMRT:", e.message); process.exitCode = 2; });
