/* Vizualna presoja najhujših primerov: katera gostost se dejansko uporabi,
   to tudi poslika. Zamik do slike je enak kot v sondei, da posnetek ustreza
   odmerjeni odločitvi. */
const { spawn } = require("child_process");
const fs = require("fs");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9423, wait = ms => new Promise(r => setTimeout(r, ms));
const ZASLONI = { "320": [320, 640, 2], "390": [390, 844, 3] };
const PRIMERI = [["320", "domov"], ["320", "termini"], ["320", "h70"], ["390", "domov"]];
(async () => {
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}\\cdp-slika-${Date.now()}`,
    "--no-first-run", "--window-size=1500,1000", "about:blank"], { stdio: "ignore" });
  let v; for (let i = 0; i < 40; i++) { try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await wait(400); } }
  const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener("open", r));
  let n = 0; const p = new Map();
  const send = (m, pr = {}, sid) => new Promise((res, rej) => { const id = ++n; p.set(id, { res, rej });
    ws.send(JSON.stringify(sid ? { id, method: m, params: pr, sessionId: sid } : { id, method: m, params: pr })); });
  ws.addEventListener("message", ev => { const m = JSON.parse(ev.data); if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id); m.error ? q.rej(new Error(JSON.stringify(m.error))) : q.res(m.result); } });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const sess = (m, pr = {}) => send(m, pr, sessionId);
  const ev = async ex => { const r = await sess("Runtime.evaluate", { expression: ex, returnByValue: true });
    if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description || r.exceptionDetails)); return r.result.value; };
  await sess("Page.enable"); await sess("Runtime.enable");
  for (const [z, pg] of PRIMERI) {
    const [w, h, dpr] = ZASLONI[z];
    await sess("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile: true });
    await sess("Page.navigate", { url: `http://127.0.0.1:4183/index.html#${pg}` });
    for (let i = 0; i < 80; i++) { if (await ev("document.documentElement.classList.contains('pripravljen')")) break; await wait(120); }
    await wait(2600);
    const odlocitev = await ev(`__gostota.g + ' / olajsave ' + __gostota.olajsave + ' / zunaj ' + __gostota.izven`);
    const s = await sess("Page.captureScreenshot", { format: "png" });
    const pot = `${process.env.TEMP}\\rka-${z}-${pg}.png`;
    fs.writeFileSync(pot, Buffer.from(s.data, "base64"));
    console.log(`${pot}  g=${odlocitev}`);
  }
  ws.close(); chrome.kill();
})().catch(e => { console.error("SMRT:", e.message); process.exitCode = 2; });
