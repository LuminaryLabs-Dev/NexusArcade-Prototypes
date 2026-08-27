import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve('_site');
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
  '--ignore-gpu-blocklist', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
async function scenario(name, pathname, ready, action, assertion, timeoutMs = 15000) {
  const { targetId } = await call('Target.createTarget', { url: 'about:blank', width: 1280, height: 800 });
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

try {
  await scenario('catalog', '', "document.querySelectorAll('.featured-slide').length===3", null, "document.querySelectorAll('.card').length===7");
  await scenario('Knockout Circuit', 'games/knockout-circuit/', 'window.KnockoutCircuit', 'KnockoutCircuit.startNewCampaign()', "KnockoutCircuit.getUiState().mode==='campaign' && KnockoutCircuit.getState().fighters[1].name==='Boiler Bruiser'");
  await scenario('Blood Maiden', 'games/blood-maiden/', 'window.BloodMaiden', "document.querySelector('#startBtn').click();BloodMaiden.saveProgress()", "BloodMaiden.getProgress()?.schema==='blood-maiden-pilgrimage/1'");
  await scenario('Bubble Raft Assault', 'games/bubble-raft-assault/', 'window.BubbleRaftAssault', 'BubbleRaftAssault.startCampaign()', "BubbleRaftAssault.getSavedCampaign()?.schema==='bubble-raft-campaign/1'");
  await scenario('Gothic Revolt', 'games/gothic-revolt/?review', 'window.__GothicRevolt?.ready', '__GothicRevolt.start(76100);__GothicRevolt.advance(1)', "__GothicRevolt.snapshot().mode==='run' && __GothicRevolt.snapshot().elapsed>=1");
  await scenario('Rift Runner', 'games/rift-runner/', "document.querySelector('#panel')?.textContent.includes('PRESS ENTER')", "document.dispatchEvent(new KeyboardEvent('keydown',{code:'Enter',key:'Enter',bubbles:true}));setTimeout(()=>document.dispatchEvent(new KeyboardEvent('keyup',{code:'Enter',key:'Enter',bubbles:true})),80)", "document.querySelector('#hud')?.style.display==='block'", 20000);
  await scenario('The Long Haul', 'games/the-long-haul/', 'window.__longHaulBooted===true', null, "document.querySelector('#title-screen')?.classList.contains('active')", 25000);
  await scenario('Bumble Beez', 'games/bumble-beez/?autoplay=1', "document.querySelector('#status')?.textContent==='Bumble Beez ready'", null, "window.__BUMBLE_STATE__?.mode==='playing' && window.__BUMBLE_STATE__.time>=1");
} finally {
  socket.close(); child.kill('SIGTERM'); server.close(); await rm(profile, { recursive: true, force: true });
}

console.log('browser smoke gate passed');
