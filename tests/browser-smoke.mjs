import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve('_site');
const REVIEW_DIR = process.env.KNOCKOUT_REVIEW_DIR ? path.resolve(process.env.KNOCKOUT_REVIEW_DIR) : null;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(ROOT, relative.endsWith('/') ? `${relative}index.html` : relative);
    if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) throw new Error('outside site');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch { response.writeHead(404).end('not found'); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const candidates = [process.env.CHROME_PATH, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean);
const chrome = candidates.find((candidate) => spawnSync(candidate, ['--version'], { stdio: 'ignore' }).status === 0);
assert.ok(chrome, 'Chrome or Chromium is required for the browser smoke gate');
const profile = await mkdtemp(path.join(tmpdir(), 'nexus-arcade-chrome-'));
const child = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--window-size=1280,800',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function stopChrome() {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      delay(3000)
    ]);
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { await rm(profile, { recursive: true, force: true }); return; }
    catch (error) {
      if (error.code !== 'ENOTEMPTY' || attempt === 4) throw error;
      await delay(100 * (attempt + 1));
    }
  }
}
async function devtoolsEndpoint() {
  const file = path.join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const [debugPort] = (await readFile(file, 'utf8')).trim().split(/\s+/);
      const pages = await fetch(`http://127.0.0.1:${debugPort}/json/version`).then((response) => response.json());
      return pages.webSocketDebuggerUrl;
    } catch { await delay(100); }
  }
  throw new Error('Chrome did not expose DevTools');
}

const socket = new WebSocket(await devtoolsEndpoint());
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let callId = 0;
const pending = new Map(), listeners = new Set();
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(String(data));
  if (message.id) {
    const task = pending.get(message.id); pending.delete(message.id);
    if (message.error) task?.reject(new Error(`${task.method}: ${message.error.message}`)); else task?.resolve(message.result);
  } else for (const listener of listeners) listener(message);
});
function call(method, params = {}, sessionId) {
  const id = ++callId;
  socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
}
function event(method, sessionId, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { listeners.delete(listener); reject(new Error(`Timed out waiting for ${method}`)); }, timeoutMs);
    const listener = (message) => {
      if (message.method === method && (!sessionId || message.sessionId === sessionId)) { clearTimeout(timeout); listeners.delete(listener); resolve(message.params); }
    };
    listeners.add(listener);
  });
}
async function evaluate(sessionId, expression) {
  const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(sessionId, expression, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(sessionId, `Boolean(${expression})`)) return;
    await delay(150);
  }
  throw new Error(`Condition did not become true: ${expression}`);
}
async function screenshot(sessionId, filename) {
  const { data } = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
  await writeFile(path.join(REVIEW_DIR, filename), Buffer.from(data, 'base64'));
}
async function scenario(name, pathname, ready, action, assertion, timeoutMs = 15000) {
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  const errors = [];
  const capture = (message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map((arg) => arg.value || arg.description).join(' '));
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
  };
  listeners.add(capture);
  try {
    await Promise.all([call('Page.enable', {}, sessionId), call('Runtime.enable', {}, sessionId), call('Log.enable', {}, sessionId)]);
    const loaded = event('Page.loadEventFired', sessionId, timeoutMs);
    await call('Page.navigate', { url: `http://127.0.0.1:${port}/${pathname}` }, sessionId);
    await loaded;
    await waitFor(sessionId, ready, timeoutMs);
    if (action) await evaluate(sessionId, action);
    await waitFor(sessionId, assertion, timeoutMs);
    assert.deepEqual(errors, [], `${name} emitted browser errors:\n${errors.join('\n')}`);
    console.log(`browser smoke ok: ${name}`);
  } finally {
    listeners.delete(capture);
    await call('Target.closeTarget', { targetId });
  }
}

async function reviewKnockout() {
  await mkdir(REVIEW_DIR, { recursive: true });
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  const browserFindings = [];
  const capture = (message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === 'Runtime.exceptionThrown') browserFindings.push({ level: 'error', message: message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text });
    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) browserFindings.push({ level: message.params.type, message: message.params.args.map((arg) => arg.value || arg.description).join(' ') });
    if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params.entry.level)) browserFindings.push({ level: message.params.entry.level, message: message.params.entry.text, url: message.params.entry.url });
  };
  listeners.add(capture);
  const samples = [];
  const interactions = [];
  const startedAt = Date.now();
  try {
    await Promise.all([
      call('Page.enable', {}, sessionId), call('Runtime.enable', {}, sessionId), call('Log.enable', {}, sessionId),
      call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId)
    ]);
    const loaded = event('Page.loadEventFired', sessionId, 20000);
    await call('Page.navigate', { url: `http://127.0.0.1:${port}/games/knockout-circuit/` }, sessionId);
    await loaded;
    await waitFor(sessionId, 'window.KnockoutCircuit', 20000);
    const initial = await evaluate(sessionId, '({ui:KnockoutCircuit.getUiState(),state:KnockoutCircuit.getState()})');
    await screenshot(sessionId, '00-start-screen.png');
    await evaluate(sessionId, 'KnockoutCircuit.startNewCampaign();KnockoutCircuit.setInput("right",true);KnockoutCircuit.setInput("punch",true)');
    interactions.push({ atSeconds: 0, action: 'Start Circuit Run; hold right and punch' });
    for (let second = 1; second <= 60; second += 1) {
      await delay(1000);
      let sample = await evaluate(sessionId, '({ui:KnockoutCircuit.getUiState(),state:KnockoutCircuit.getState()})');
      if (sample.ui.upgradeVisible) {
        const installed = await evaluate(sessionId, '(()=>{const button=[...document.querySelectorAll("#upgradeGrid button")].find((candidate)=>!candidate.disabled);if(!button)return null;const name=button.querySelector("b")?.textContent;button.click();return name})()');
        if (installed) interactions.push({ atSeconds: second, action: `Install ${installed} and continue` });
      } else if (sample.ui.resultVisible) {
        await evaluate(sessionId, 'document.querySelector("#resultBtn").click()');
        interactions.push({ atSeconds: second, action: 'Fight again after result' });
      }
      await evaluate(sessionId, 'KnockoutCircuit.setInput("right",true);KnockoutCircuit.setInput("punch",true)');
      sample = await evaluate(sessionId, '({ui:KnockoutCircuit.getUiState(),state:KnockoutCircuit.getState()})');
      samples.push({ second, ui: sample.ui, tick: sample.state.tick, round: sample.state.round, phase: sample.state.phase, fighters: sample.state.fighters.map(({ name, hp, maxHp, x }) => ({ name, hp, maxHp, x })) });
      if (second % 5 === 0) await screenshot(sessionId, `${String(second).padStart(2, '0')}-gameplay.png`);
    }
    await evaluate(sessionId, 'KnockoutCircuit.setInput("right",false);KnockoutCircuit.setInput("punch",false)');
    const final = await evaluate(sessionId, '({ui:KnockoutCircuit.getUiState(),state:KnockoutCircuit.getState()})');
    await screenshot(sessionId, '61-final-state.png');
    const durationSeconds = (Date.now() - startedAt) / 1000;
    const validation = {
      schema: 'nexus-browser-review/1',
      target: 'Knockout Circuit campaign',
      captureKind: 'timed-screenshot-sequence',
      nativeVideo: false,
      durationSeconds,
      viewport: { width: 1280, height: 800 },
      initial,
      final,
      samples,
      interactions,
      browserFindings,
      checks: {
        fullDuration: durationSeconds >= 60,
        fixedTickAdvanced: samples.at(-1)?.tick > samples[0]?.tick,
        combatChangedHealth: samples.some((sample) => sample.fighters.some((fighter) => fighter.hp < fighter.maxHp)),
        noBrowserErrors: !browserFindings.some((finding) => finding.level === 'error')
      }
    };
    await writeFile(path.join(REVIEW_DIR, 'validation.json'), `${JSON.stringify(validation, null, 2)}\n`);
    assert.ok(validation.checks.fullDuration, 'Knockout review did not span 60 seconds');
    assert.ok(validation.checks.fixedTickAdvanced, 'Knockout review tick did not advance');
    assert.ok(validation.checks.combatChangedHealth, 'Knockout review did not exercise combat');
    assert.ok(validation.checks.noBrowserErrors, `Knockout review emitted browser errors: ${JSON.stringify(browserFindings)}`);
    console.log(`browser review ok: Knockout Circuit ${durationSeconds.toFixed(1)}s, ${samples.length} samples`);
  } finally {
    listeners.delete(capture);
    await call('Target.closeTarget', { targetId });
  }
}

async function openKnockoutPeer(label, findings) {
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  const capture = (message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === 'Runtime.exceptionThrown') findings.push({ peer: label, level: 'error', message: message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text });
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') findings.push({ peer: label, level: 'error', message: message.params.args.map((arg) => arg.value || arg.description).join(' ') });
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') findings.push({ peer: label, level: 'error', message: message.params.entry.text, url: message.params.entry.url });
  };
  listeners.add(capture);
  try {
    await Promise.all([
      call('Page.enable', {}, sessionId), call('Runtime.enable', {}, sessionId), call('Log.enable', {}, sessionId),
      call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId)
    ]);
    const loaded = event('Page.loadEventFired', sessionId, 25000);
    await call('Page.navigate', { url: `http://127.0.0.1:${port}/games/knockout-circuit/` }, sessionId);
    await loaded;
    await waitFor(sessionId, 'window.KnockoutCircuit && typeof window.Peer === "function"', 25000);
    return { label, targetId, sessionId, capture };
  } catch (error) {
    listeners.delete(capture);
    await call('Target.closeTarget', { targetId });
    throw error;
  }
}

async function multiplayerScenario() {
  const findings = [], peers = [];
  try {
    const host = await openKnockoutPeer('host', findings); peers.push(host);
    const client = await openKnockoutPeer('client', findings); peers.push(client);
    await evaluate(host.sessionId, 'document.querySelector("#onlineBtn").click();document.querySelector("#hostBtn").click();true');
    try {
      await waitFor(host.sessionId, '/^[A-Z2-9]{6}$/.test(document.querySelector("#roomCode").textContent) && ["Waiting","Syncing","Ready"].includes(KnockoutCircuit.getUiState().status)', 30000);
    } catch (error) {
      const diagnostic = await evaluate(host.sessionId, '({ui:KnockoutCircuit.getUiState(),room:document.querySelector("#roomCode").textContent,detail:document.querySelector("#netState").textContent})');
      throw new Error(`PeerJS host did not open: ${JSON.stringify({ diagnostic, findings, cause: error.message })}`);
    }
    const roomCode = await evaluate(host.sessionId, 'document.querySelector("#roomCode").textContent');
    await evaluate(client.sessionId, `(()=>{const code=${JSON.stringify(roomCode)};document.querySelector("#onlineBtn").click();document.querySelector("#joinTab").click();document.querySelector("#joinCode").value=code;document.querySelector("#joinBtn").click();return true})()`);
    await Promise.all([
      waitFor(host.sessionId, 'KnockoutCircuit.getUiState().mode==="multi" && KnockoutCircuit.getUiState().status==="Ready"', 35000),
      waitFor(client.sessionId, 'KnockoutCircuit.getUiState().mode==="multi" && KnockoutCircuit.getUiState().status==="Ready"', 35000)
    ]);
    const before = {
      host: await evaluate(host.sessionId, 'KnockoutCircuit.getState()'),
      client: await evaluate(client.sessionId, 'KnockoutCircuit.getState()')
    };
    await evaluate(host.sessionId, 'KnockoutCircuit.setInput("right",true);KnockoutCircuit.setInput("punch",true)');
    await evaluate(client.sessionId, 'KnockoutCircuit.setInput("left",true);KnockoutCircuit.setInput("punch",true)');
    await delay(4000);
    await evaluate(host.sessionId, 'KnockoutCircuit.setInput("right",false);KnockoutCircuit.setInput("punch",false)');
    await evaluate(client.sessionId, 'KnockoutCircuit.setInput("left",false);KnockoutCircuit.setInput("punch",false)');
    await delay(750);
    const after = {
      host: await evaluate(host.sessionId, 'KnockoutCircuit.getState()'),
      client: await evaluate(client.sessionId, 'KnockoutCircuit.getState()')
    };
    const checks = {
      bothAdvanced: after.host.tick > before.host.tick && after.client.tick > before.client.tick,
      ticksSynchronized: Math.abs(after.host.tick - after.client.tick) <= 20,
      authorityAgrees: after.host.round === after.client.round && after.host.phase === after.client.phase && after.host.fighters.every((fighter, index) => fighter.hp === after.client.fighters[index].hp),
      noBrowserErrors: findings.length === 0
    };
    if (REVIEW_DIR) await writeFile(path.join(REVIEW_DIR, 'multiplayer-validation.json'), `${JSON.stringify({ schema: 'nexus-peerjs-browser-proof/1', roomCode, before, after, findings, checks }, null, 2)}\n`);
    assert.ok(checks.bothAdvanced, 'PeerJS match ticks did not advance on both peers');
    assert.ok(checks.ticksSynchronized, `PeerJS peer ticks drifted: host ${after.host.tick}, client ${after.client.tick}`);
    assert.ok(checks.authorityAgrees, 'PeerJS peers disagreed on authoritative health, phase, or round');
    assert.ok(checks.noBrowserErrors, `PeerJS browser errors: ${JSON.stringify(findings)}`);
    console.log(`browser multiplayer ok: host ${after.host.tick}, client ${after.client.tick}, hp ${after.host.fighters.map((fighter) => fighter.hp).join('/')}`);
  } finally {
    for (const peer of peers.reverse()) {
      listeners.delete(peer.capture);
      await call('Target.closeTarget', { targetId: peer.targetId });
    }
  }
}

try {
  await scenario('catalog', '', "document.querySelectorAll('.featured-slide').length===3", null, "document.querySelectorAll('.card').length===7");
  await scenario('Knockout Circuit', 'games/knockout-circuit/', 'window.KnockoutCircuit', 'KnockoutCircuit.startNewCampaign()', "KnockoutCircuit.getUiState().mode==='campaign' && KnockoutCircuit.getState().fighters[1].name==='Boiler Bruiser'");
  await multiplayerScenario();
  if (REVIEW_DIR) await reviewKnockout();
  await scenario('Blood Maiden', 'games/blood-maiden/', 'window.BloodMaiden', "document.querySelector('#startBtn').click();BloodMaiden.saveProgress()", "BloodMaiden.getProgress()?.schema==='blood-maiden-pilgrimage/1'");
  await scenario('Bubble Raft Assault', 'games/bubble-raft-assault/', 'window.BubbleRaftAssault', 'BubbleRaftAssault.startCampaign()', "BubbleRaftAssault.getSavedCampaign()?.schema==='bubble-raft-campaign/1'");
  await scenario('Gothic Revolt', 'games/gothic-revolt/?review', 'window.__GothicRevolt?.ready', '__GothicRevolt.start(76100);__GothicRevolt.advance(1)', "__GothicRevolt.snapshot().mode==='run' && __GothicRevolt.snapshot().elapsed>=1");
  await scenario('Rift Runner', 'games/rift-runner/', "document.querySelector('#panel')?.textContent.includes('PRESS ENTER')", "document.dispatchEvent(new KeyboardEvent('keydown',{code:'Enter',key:'Enter',bubbles:true}));setTimeout(()=>document.dispatchEvent(new KeyboardEvent('keyup',{code:'Enter',key:'Enter',bubbles:true})),80)", "document.querySelector('#hud')?.style.display==='block'", 20000);
  await scenario('The Long Haul', 'games/the-long-haul/', 'window.__longHaulBooted===true', null, "document.querySelector('#title-screen')?.classList.contains('active')", 25000);
  await scenario('Bumble Beez', 'games/bumble-beez/?autoplay=1', "document.querySelector('#status')?.textContent==='Bumble Beez ready'", null, "window.__BUMBLE_STATE__?.mode==='playing' && window.__BUMBLE_STATE__.time>=1");
} finally {
  socket.close(); server.close(); await stopChrome();
}

console.log('browser smoke gate passed');
