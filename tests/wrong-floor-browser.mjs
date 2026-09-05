import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

/** Uses the repository smoke runner's CDP transport and localhost server. */
export async function runWrongFloorBrowserChecks({ call, event, evaluate, waitFor, listeners, baseUrl, delay }) {
  const provenance={commit:process.env.GITHUB_SHA??null,manifestSha256:createHash('sha256').update(await readFile('registry/games/NXA-000010.json')).digest('hex'),definitionSha256:createHash('sha256').update(await readFile('docs/wrong-floor/rules.md')).digest('hex'),startedAt:new Date().toISOString()};
  const reviewDir = process.env.WRONG_FLOOR_REVIEW_DIR ? path.resolve(process.env.WRONG_FLOOR_REVIEW_DIR) : null;
  if (reviewDir) await mkdir(reviewDir, { recursive: true });
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  const findings = [], requests = [], screenshots = [], interactions = [];
  const capture = message => {
    if (message.sessionId !== sessionId) return;
    if (message.method === 'Runtime.exceptionThrown') findings.push({ level: 'error', message: message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text });
    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) findings.push({ level: message.params.type, message: message.params.args.map(arg => arg.value || arg.description).join(' ') });
    if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params.entry.level)) findings.push({ level: message.params.entry.level, message: message.params.entry.text, url: message.params.entry.url });
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
  };
  listeners.add(capture);
  const run = expression => evaluate(sessionId, expression);
  const wait = (expression, timeout = 20000) => waitFor(sessionId, expression, timeout);
  const key = async (code, down) => {
    const keyValue = code === 'Space' ? ' ' : code;
    await call('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', code, key: keyValue, windowsVirtualKeyCode: code === 'Space' ? 32 : code === 'Escape' ? 27 : 13 }, sessionId);
  };
  const tap = async code => { await key(code, true); await key(code, false); };
  const screenshot = async filename => {
    if (!reviewDir) return;
    const { data } = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
    await writeFile(path.join(reviewDir, filename), Buffer.from(data, 'base64'));
    screenshots.push(filename);
  };
  const click = async selector => {
    const point = await run(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 }, sessionId);
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 }, sessionId);
  };
  let report, fullSession = null;
  try {
    await Promise.all(['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable'].map(method => call(method, {}, sessionId)));
    await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
    const loaded = event('Page.loadEventFired', sessionId, 30000);
    await call('Page.navigate', { url: `${baseUrl}/games/wrong-floor/?review=1` }, sessionId);
    await loaded;
    await wait('window.__wrongFloor && !document.querySelector("#fatal-error")?.textContent', 30000);
    const webgl = await run(`(()=>{const c=document.querySelector('#scene');const gl=c.getContext('webgl2');return{width:c.width,height:c.height,webgl2:!!gl,contextLost:gl?.isContextLost(),version:gl?.getParameter(gl.VERSION),layout:{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},inspection:__wrongFloor.inspect()}})()`);
    assert.equal(webgl.webgl2, true, 'game has a real WebGL2 renderer');
    assert.equal(webgl.contextLost, false, 'WebGL context is live');
    assert.ok(webgl.width >= 640 && webgl.height >= 400, 'renderer has a useful drawing buffer');
    assert.ok(webgl.inspection.renderer?.triangles > 0, 'actual triangles were rendered');
    assert.ok(webgl.layout.scrollWidth <= webgl.layout.width && webgl.layout.scrollHeight <= webgl.layout.height, 'game fits desktop viewport');
    await screenshot('00-title.png');

    // This uses trusted browser input, not the deterministic review controls.
    await click('#play-button');
    await wait('__wrongFloor.snapshot().mode === "running" && __wrongFloor.snapshot().roundTime > 1.0', 60000);
    const beforeClose = await run('__wrongFloor.snapshot()');
    assert.equal(beforeClose.round.danger, false, 'first floor establishes a safe baseline');
    await screenshot('01-normal-floor.png');
    await key('Space', true);
    await wait('__wrongFloor.snapshot().mistakes === 1');
    await key('Space', false);
    const afterClose = await run('__wrongFloor.snapshot()');
    assert.equal(afterClose.outcome, 'false-alarm');
    assert.equal(afterClose.door.openness, 0);
    interactions.push({ action: 'Mouse Start, real Space hold and release', before: beforeClose, after: afterClose });
    await tap('Escape');
    await wait('__wrongFloor.snapshot().mode === "paused"');
    const paused = await run('__wrongFloor.snapshot()');
    await delay(400);
    assert.deepEqual(await run('__wrongFloor.snapshot()'), paused, 'pause freezes the complete game snapshot');
    await screenshot('02-paused.png');
    await tap('Escape');
    await wait('__wrongFloor.snapshot().mode === "running"');
    interactions.push({ action: 'Real Escape pause and resume', pausedAt: paused.elapsed });

    if (process.env.WRONG_FLOOR_FULL_RUN === '1') {
      // This is a wall-clock browser session. It must never invoke advance(),
      // virtual time, hidden timer manipulation, or the manual-clock option.
      await run("__wrongFloor.start({seed:'browser-realtime-full-session'})");
      const started = Date.now();
      let holding = false, lastSampleAt = -1;
      const resolved = new Set();
      fullSession = { schema: 'wrong-floor-realtime-session/1', seed: 'browser-realtime-full-session', control: 'trusted CDP keyboard input', clock: 'application requestAnimationFrame; no time manipulation', startedAt: new Date(started).toISOString(), wallSeconds: 0, samples: [], rounds: [], final: null, completed: false };
      try {
        while (Date.now() - started < 900000) {
          const state = await run('__wrongFloor.snapshot()');
          fullSession.final = state;
          fullSession.wallSeconds = (Date.now() - started) / 1000;
          if (state.elapsed - lastSampleAt >= 0.25 || state.mode !== 'running') {
            fullSession.samples.push({ wallSeconds: fullSession.wallSeconds, elapsed: state.elapsed, roundIndex: state.roundIndex, roundTime: state.roundTime, mode: state.mode, outcome: state.outcome, doorOpenness: state.door.openness, clueVisible: state.clueVisible, threatProgress: state.threatProgress, mistakes: state.mistakes, score: state.score });
            lastSampleAt = state.elapsed;
          }
          const shouldHold = state.mode === 'running' && state.round.danger && state.clueVisible && !state.resolved;
          if (shouldHold !== holding) {
            await key('Space', shouldHold);
            holding = shouldHold;
          }
          if (state.resolved && !resolved.has(state.roundIndex)) {
            resolved.add(state.roundIndex);
            fullSession.rounds.push({ roundIndex: state.roundIndex, round: state.round, elapsed: state.elapsed, outcome: state.outcome, mistakes: state.mistakes, score: state.score });
            // Capture only after resolution so image work cannot consume the
            // player's current response window.
            if ((state.roundIndex + 1) % 5 === 0) await screenshot(`full-session-round-${String(state.roundIndex + 1).padStart(2, '0')}.png`);
            if (reviewDir) await writeFile(path.join(reviewDir, 'full-session-trace.json'), `${JSON.stringify(fullSession, null, 2)}\n`);
          }
          if (state.mode === 'won' || state.mode === 'lost') break;
          assert.equal(state.mode, 'running', 'real-time session must remain running without synthetic pauses');
          await delay(100);
        }
        assert.equal(fullSession.final.mode, 'won', `real-time full session did not escape: ${JSON.stringify(fullSession.final)}`);
        assert.equal(fullSession.final.elapsed, 300, 'real-time session must accumulate 300 active seconds');
        assert.equal(fullSession.rounds.length, 30, 'real-time session must observe all 30 resolved rounds');
        assert.equal(fullSession.final.correct, 30);
        assert.equal(fullSession.final.mistakes, 0);
        assert.ok(fullSession.wallSeconds >= 299, 'full session cannot be accelerated');
        assert.ok(fullSession.rounds.every(round => ['sealed', 'accepted'].includes(round.outcome)));
        fullSession.completed = true;
        await delay(1800);
        await screenshot('full-session-escape.png');
        console.log(`browser Wrong Floor real-time session ok: ${fullSession.wallSeconds.toFixed(1)} wall seconds, 300 active seconds, 30 correct rounds`);
      } finally {
        if (holding) await key('Space', false);
        fullSession.endedAt = new Date().toISOString();
        if (reviewDir) await writeFile(path.join(reviewDir, 'full-session-trace.json'), `${JSON.stringify(fullSession, null, 2)}\n`);
      }
    }

    // Separate deterministic game proof: explicit active-time stepping, not real-time footage.
    const complete = await run(`(async()=>{
      await __wrongFloor.start({seed:'browser-complete',manual:true});
      const rounds=[];
      for(let i=0;i<30;i++){
        const r=__wrongFloor.snapshot().round;
        if(r.danger){
          __wrongFloor.advance(r.clueAt+.1,{close:false});
          __wrongFloor.advance(1.2,{close:true});
        }else __wrongFloor.advance(7.3,{close:false});
        const result=__wrongFloor.snapshot();
        rounds.push({roundIndex:result.roundIndex,round:result.round,elapsed:result.elapsed,door:result.door,outcome:result.outcome,mode:result.mode,score:result.score});
        if(result.mode!=='running')break;
        __wrongFloor.advance(Math.max(0,10-result.roundTime),{close:false});
      }
      return {rounds,final:__wrongFloor.snapshot(),inspection:__wrongFloor.inspect()};
    })()`);
    assert.equal(complete.rounds.length, 30, 'browser exercised all 30 stops');
    assert.equal(complete.final.mode, 'won'); assert.equal(complete.final.elapsed, 300);
    assert.equal(complete.final.correct, 30); assert.equal(complete.final.mistakes, 0);
    assert.equal(new Set(complete.rounds.filter(r => r.round.danger).map(r => `${r.round.entity}:${r.round.variant}`)).size, 12);
    assert.ok(complete.rounds.every(r => r.outcome === 'sealed' || r.outcome === 'accepted'));
    await screenshot('03-escape.png');

    const failures = await run(`(async()=>{
      await __wrongFloor.start({seed:'browser-no-input',manual:true});
      __wrongFloor.advance(300,{close:false});
      const intrusion=__wrongFloor.snapshot();
      await __wrongFloor.start({seed:'browser-false-alarms',manual:true});
      for(let i=0;i<3;i++){
        __wrongFloor.advance(.81,{close:false});
        __wrongFloor.advance(1.2,{close:true});
        const s=__wrongFloor.snapshot();if(s.mode!=='running')break;
        __wrongFloor.advance(10-s.roundTime,{close:false});
      }
      return {intrusion,shutdown:__wrongFloor.snapshot()};
    })()`);
    assert.equal(failures.intrusion.failureReason, 'intrusion');
    assert.equal(failures.shutdown.failureReason, 'shutdown');
    assert.equal(failures.shutdown.mistakes, 3);
    await screenshot('04-shutdown.png');

    const variants = [];
    const families = ['guest', 'tall', 'ceiling', 'porter', 'shadow', 'mannequin'];
    for (let familyIndex = 0; familyIndex < families.length; familyIndex++) {
      for (const variant of [0, 1]) {
        const specification = { entity: families[familyIndex], variant, environment: ['office', 'hotel', 'basement'][(familyIndex + variant) % 3], seed: `review-${families[familyIndex]}-${variant}`, roundTime: 3.5, clueAt: 1.5, arrivalAt: 5.0 };
        await run(`__wrongFloor.preview(${JSON.stringify(specification)})`);
        await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const inspection = await run('__wrongFloor.inspect()');
        assert.ok(inspection.renderer?.triangles > 0, `${specification.entity}:${variant} rendered geometry`);
        assert.ok(inspection.artifactHash, `${specification.entity}:${variant} has a procedural factory artifact`);
        variants.push({ ...specification, inspection });
        await screenshot(`entity-${specification.entity}-${variant}.png`);
      }
    }
    await run('__wrongFloor.stopPreview()');
    const externalRequests = requests.filter(url => /^https?:/.test(url) && new URL(url).origin !== new URL(baseUrl).origin);
    assert.deepEqual(externalRequests, [], 'game runtime uses only bundled local resources');
    assert.deepEqual(findings.filter(f => f.level === 'error'), [], `Wrong Floor emitted errors: ${JSON.stringify(findings)}`);
    report = { schema: 'wrong-floor-browser-review/1', provenance, captureKind: fullSession ? 'real-time-input-session-plus-screenshots-and-manual-trace' : 'screenshots-and-manual-simulation-trace', realTimeFullRunVideo: false, viewport: { width: 1280, height: 800 }, webgl, interactions, fullSession, complete, failures, variants, screenshots, requests: [...new Set(requests)], findings, checks: { actualWebGL: true, realKeyboardClosure: true, realKeyboardPause: true, thirtyRoundEscape: true, activeSimulationSeconds: 300, realtimeFullSession: fullSession?.completed ?? 'not requested', allTwelveVariants: true, bothFailureTypes: true, noExternalRuntimeDependencies: true, noBrowserErrors: true } };
    if (reviewDir) await writeFile(path.join(reviewDir, 'validation.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log('browser Wrong Floor ok: real keyboard closure/pause, 30 stops/300 simulated seconds, 12 factory variants');
    return report;
  } finally {
    if (reviewDir && !report) await writeFile(path.join(reviewDir, 'incomplete-findings.json'), `${JSON.stringify({ provenance, findings, requests, screenshots, interactions, fullSession }, null, 2)}\n`);
    listeners.delete(capture);
    await call('Target.closeTarget', { targetId });
  }
}
