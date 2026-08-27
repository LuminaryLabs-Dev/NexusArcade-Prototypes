import {
  KNOCKOUT_BOSSES,
  KNOCKOUT_UPGRADES,
  applyKnockoutInputs,
  createInitialKnockoutState,
  createKnockoutSimulationAdapter,
  stepKnockoutState
} from "./simulation.mjs";

const $ = (selector) => document.querySelector(selector);
const canvas = $("#game");
const ctx = canvas.getContext("2d");
const FIXED_DELTA = 1 / 60;
const SAVE_KEY = "nexus.knockout-circuit.campaign.v1";
const ui = {
  start: $("#start"), lobby: $("#lobby"), actions: $("#menuActions"), hud: $("#hud"),
  status: $("#statusText"), dot: $("#statusDot"), net: $("#netState"),
  upgrade: $("#upgrade"), result: $("#result"), announcement: $("#announcement")
};

let mode = "menu";
let resultMode = "campaign";
let session = null;
let sessionRole = null;
let unsubscribeStatus = null;
let campaign = null;
let campaignAccumulator = 0;
let campaignProgress = loadCampaignProgress();
let input = { left: false, right: false, punch: false };
let last = performance.now();
let networkLast = performance.now();
let display = [{ x: 300 }, { x: 660 }];
let roomCode = "";
let particles = [];
let shake = 0;
let lastEventId = 0;
let lastCorrectionSequence = -1;
let audio = null;
let networkModulesPromise = null;

const randomCode = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
const currentInput = () => ({ move: (input.right ? 1 : 0) - (input.left ? 1 : 0), punch: input.punch });
const playing = () => mode === "campaign" || mode === "multi";

function normalProgress(value) {
  if (!value || value.schema !== "knockout-circuit-campaign/1") return null;
  const bossIndex = Number(value.bossIndex);
  if (!Number.isInteger(bossIndex) || bossIndex < 0 || bossIndex >= KNOCKOUT_BOSSES.length) return null;
  const upgrades = Object.fromEntries(["power", "armor", "drive"].map((key) => [key, Math.max(0, Math.min(3, Math.floor(Number(value.upgrades?.[key]) || 0)))]));
  return { schema: "knockout-circuit-campaign/1", bossIndex, upgrades, pendingUpgrade: Boolean(value.pendingUpgrade) };
}

function loadCampaignProgress() {
  try { return normalProgress(JSON.parse(localStorage.getItem(SAVE_KEY))); }
  catch { return null; }
}

function saveCampaignProgress(value) {
  campaignProgress = normalProgress(value);
  try {
    if (campaignProgress) localStorage.setItem(SAVE_KEY, JSON.stringify(campaignProgress));
    else localStorage.removeItem(SAVE_KEY);
  } catch {}
  refreshCampaignAction();
}

function refreshCampaignAction() {
  const title = $("#circuitTitle"), copy = $("#circuitCopy"), reset = $("#newCircuitBtn");
  if (campaignProgress) {
    title.textContent = "Continue Circuit";
    copy.textContent = campaignProgress.pendingUpgrade
      ? `${KNOCKOUT_BOSSES[campaignProgress.bossIndex].name} defeated · choose an upgrade`
      : `Boss ${campaignProgress.bossIndex + 1} of ${KNOCKOUT_BOSSES.length} · ${KNOCKOUT_BOSSES[campaignProgress.bossIndex].name}`;
    reset.hidden = false;
  } else {
    title.textContent = "Circuit Run";
    copy.textContent = "Five named bosses · choose upgrades";
    reset.hidden = true;
  }
}

function setStatus(phase, detail) {
  const labels = {
    idle: "Online lobby", creating: "Creating", waiting: "Waiting", connecting: "Connecting",
    syncing: "Syncing", ready: "Ready", campaign: "Circuit run", "connection-lost": "Connection lost",
    failed: "Connection failed", closed: "Closed", menu: "Attract mode"
  };
  ui.status.textContent = labels[phase] ?? phase;
  ui.dot.classList.toggle("ready", phase === "ready" || phase === "campaign");
  if (detail) ui.net.textContent = detail;
}

function announce(text) {
  ui.announcement.textContent = text;
  ui.announcement.classList.remove("show");
  void ui.announcement.offsetWidth;
  ui.announcement.classList.add("show");
}

function sound(type) {
  try {
    if (!audio || audio.state !== "running") return;
    const oscillator = audio.createOscillator(), gain = audio.createGain(), time = audio.currentTime;
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.type = type === "hit" ? "sawtooth" : "square";
    oscillator.frequency.setValueAtTime(type === "hit" ? 105 : type === "ko" ? 62 : 210, time);
    oscillator.frequency.exponentialRampToValueAtTime(type === "hit" ? 55 : type === "ko" ? 34 : 330, time + 0.12);
    gain.gain.setValueAtTime(0.055, time); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    oscillator.start(time); oscillator.stop(time + 0.16);
  } catch {}
}

function unlockAudio() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") void audio.resume().catch(() => {});
  } catch {}
}

function burst(x, color) {
  for (let index = 0; index < 14; index += 1) {
    const angle = (index / 14) * Math.PI * 2;
    const speed = 95 + (index % 5) * 27;
    particles.push({ x, y: 318, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 70, life: 0.38 + (index % 4) * 0.07, color });
  }
}

function consumeEvents(state) {
  for (const event of state.events ?? []) {
    if (event.id <= lastEventId) continue;
    lastEventId = event.id;
    if (event.type === "fight") { announce("Fight!"); sound("swing"); }
    if (event.type === "round") announce(`Round ${event.round}`);
    if (event.type === "hit") {
      shake = Math.min(13, shake + 7);
      burst(event.x, state.fighters[event.attacker]?.trim ?? "#ffd338");
      sound("hit");
    }
    if (event.type === "ko") { announce("K.O.!"); sound("ko"); }
  }
}

function resetPresentation(state) {
  display = state.fighters.map((fighter) => ({ x: fighter.x }));
  particles = [];
  shake = 0;
  lastEventId = state.eventSequence ?? 0;
  lastCorrectionSequence = -1;
}

function hideModals() {
  ui.upgrade.hidden = true;
  ui.result.hidden = true;
}

function showResult(title, copy, nextMode, eyebrow = "Match result") {
  resultMode = nextMode;
  $("#resultEyebrow").textContent = eyebrow;
  $("#resultTitle").textContent = title;
  $("#resultCopy").textContent = copy;
  $("#resultActionCopy").textContent = nextMode === "campaign" ? "Restart the five-boss circuit" : "Create or join a fresh room";
  ui.result.hidden = false;
}

function renderBossList(currentBoss, completedThrough = currentBoss - 1) {
  const box = $("#bossList");
  box.replaceChildren();
  KNOCKOUT_BOSSES.forEach((boss, index) => {
    const node = document.createElement("i");
    node.className = `boss-node ${index <= completedThrough ? "done" : index === currentBoss ? "current" : ""}`;
    node.title = boss.name;
    box.append(node);
  });
}

function showUpgrade() {
  if (!campaignProgress?.pendingUpgrade) return;
  mode = "upgrade";
  const defeated = KNOCKOUT_BOSSES[campaignProgress.bossIndex];
  $("#rewardLabel").textContent = `${defeated.name} defeated · 1 circuit chip`;
  const grid = $("#upgradeGrid");
  grid.replaceChildren();
  for (const upgrade of KNOCKOUT_UPGRADES) {
    const level = campaignProgress.upgrades[upgrade.id];
    const button = document.createElement("button");
    button.className = "upgrade";
    button.disabled = level >= 3;
    const name = document.createElement("b"); name.textContent = upgrade.name;
    const copy = document.createElement("span"); copy.textContent = upgrade.copy;
    const path = document.createElement("div"); path.className = "path";
    for (let index = 0; index < 3; index += 1) { const pip = document.createElement("i"); pip.className = `pip ${index < level ? "on" : ""}`; path.append(pip); }
    button.append(name, copy, path);
    button.onclick = () => chooseUpgrade(upgrade.id);
    grid.append(button);
  }
  renderBossList(Math.min(campaignProgress.bossIndex + 1, KNOCKOUT_BOSSES.length - 1), campaignProgress.bossIndex);
  ui.upgrade.hidden = false;
}

function chooseUpgrade(id) {
  if (!campaignProgress?.pendingUpgrade || !["power", "armor", "drive"].includes(id)) return;
  if (campaignProgress.upgrades[id] >= 3) return;
  const nextBoss = campaignProgress.bossIndex + 1;
  const next = {
    schema: "knockout-circuit-campaign/1",
    bossIndex: nextBoss,
    upgrades: { ...campaignProgress.upgrades, [id]: campaignProgress.upgrades[id] + 1 },
    pendingUpgrade: false
  };
  saveCampaignProgress(next);
  startCampaignFight();
}

function startCampaignFight() {
  const progress = campaignProgress ?? { schema: "knockout-circuit-campaign/1", bossIndex: 0, upgrades: { power: 0, armor: 0, drive: 0 }, pendingUpgrade: false };
  campaign = createInitialKnockoutState({ authoritative: true, mode: "campaign", bossIndex: progress.bossIndex, upgrades: progress.upgrades });
  campaignAccumulator = 0;
  mode = "campaign";
  ui.start.hidden = true;
  ui.hud.hidden = false;
  hideModals();
  resetPresentation(campaign);
  setStatus("campaign");
  announce(`Boss ${progress.bossIndex + 1}`);
}

function continueCampaign() {
  disposeSession();
  if (!campaignProgress) saveCampaignProgress({ schema: "knockout-circuit-campaign/1", bossIndex: 0, upgrades: { power: 0, armor: 0, drive: 0 }, pendingUpgrade: false });
  if (campaignProgress.pendingUpgrade) {
    ui.start.hidden = true;
    ui.hud.hidden = true;
    showUpgrade();
  } else startCampaignFight();
}

function startNewCampaign() {
  disposeSession();
  clearInput();
  saveCampaignProgress(null);
  saveCampaignProgress({ schema: "knockout-circuit-campaign/1", bossIndex: 0, upgrades: { power: 0, armor: 0, drive: 0 }, pendingUpgrade: false });
  startCampaignFight();
}

function disposeSession() {
  unsubscribeStatus?.();
  unsubscribeStatus = null;
  session?.dispose();
  session = null;
  sessionRole = null;
}

function showMenu() {
  disposeSession();
  campaign = null;
  clearInput();
  mode = "menu";
  ui.start.hidden = false;
  ui.lobby.hidden = true;
  ui.actions.hidden = false;
  ui.hud.hidden = true;
  hideModals();
  setStatus("menu");
  refreshCampaignAction();
}

async function networkModules() {
  networkModulesPromise ||= Promise.all([import("nexus-kits-host"), import("nexus-kits-peerjs")]);
  const [hostModule, peerModule] = await networkModulesPromise;
  return { createMultiplayerHostController: hostModule.createMultiplayerHostController, createPeerJSTransportProvider: peerModule.createPeerJSTransportProvider };
}

function transportProvider(createPeerJSTransportProvider) {
  if (typeof window.Peer !== "function") throw new Error("PeerJS did not load. Check the connection and retry.");
  const runtime = window.NEXUS_MULTIPLAYER_CONFIG ?? {};
  const supplied = runtime.peerOptions ?? {};
  const suppliedConfig = supplied.config ?? {};
  const iceServers = runtime.iceServers ?? suppliedConfig.iceServers ?? [{ urls: "stun:stun.l.google.com:19302" }];
  return createPeerJSTransportProvider({
    Peer: window.Peer,
    connectionTimeoutMs: Number(runtime.connectionTimeoutMs ?? 12000),
    peerOptions: { ...supplied, config: { ...suppliedConfig, iceServers } }
  });
}

async function createOnlineSession(role) {
  const { createMultiplayerHostController, createPeerJSTransportProvider } = await networkModules();
  const next = createMultiplayerHostController({
    provider: transportProvider(createPeerJSTransportProvider),
    simulation: createKnockoutSimulationAdapter({ authoritative: role === "host", mode: "multiplayer" }),
    tickRate: 60,
    snapshotRate: 20,
    handshakeRetryTicks: 15,
    handshakeTimeoutTicks: 600,
    startDelayTicks: 60,
    reconciliationSnapThreshold: 96,
    measureStateError(predicted, authoritative) {
      return Math.max(...predicted.fighters.map((fighter, index) => Math.abs(fighter.x - authoritative.fighters[index].x)));
    }
  });
  sessionRole = role;
  unsubscribeStatus = next.onStatus((status) => {
    const details = {
      creating: "Opening signaling…", waiting: "Room open. Share the code and keep this tab active.",
      connecting: "Finding the host…", syncing: "Transport open. Confirming the shared start tick…",
      ready: `Synchronized · ${status.latencyMs} ms`, failed: status.lastError ?? "The room could not synchronize.",
      "connection-lost": status.lastError ?? "The peer connection closed."
    };
    setStatus(status.phase, details[status.phase]);
    if (status.phase === "ready" && mode !== "multi") {
      mode = "multi";
      ui.start.hidden = true;
      ui.hud.hidden = false;
      hideModals();
      resetPresentation(next.getRenderState().state);
      announce("Round 1");
    }
    if (["connection-lost", "failed"].includes(status.phase)) {
      if (mode === "multi") showResult("Connection lost", "The peer connection closed. Return to the lobby and create a fresh room.", "multi");
      else ui.start.hidden = false;
    }
  });
  return next;
}

async function host() {
  try {
    disposeSession();
    roomCode = randomCode();
    $("#roomCode").textContent = roomCode;
    setStatus("creating", "Loading the multiplayer transport…");
    session = await createOnlineSession("host");
    await session.createSession({ peerId: `nexus-knockout-${roomCode.toLowerCase()}` });
  } catch (error) { setStatus("failed", error.message); }
}

async function join() {
  const value = $("#joinCode").value.trim().toLowerCase();
  if (!/^[a-z2-9]{6}$/.test(value)) { setStatus("failed", "Enter a valid six-character room code."); return; }
  try {
    disposeSession();
    setStatus("connecting", "Loading the multiplayer transport…");
    session = await createOnlineSession("client");
    await session.joinSession({ sessionId: `nexus-knockout-${value}` });
  } catch (error) { setStatus("failed", error.message); }
}

function resolveCampaign() {
  if (campaign.winner === 0) {
    if (campaign.bossIndex < KNOCKOUT_BOSSES.length - 1) {
      saveCampaignProgress({ schema: "knockout-circuit-campaign/1", bossIndex: campaign.bossIndex, upgrades: campaign.upgrades, pendingUpgrade: true });
      showUpgrade();
    } else {
      saveCampaignProgress(null);
      mode = "result";
      showResult("Circuit champion", "Boiler, Viper, Warden, Phantom, and Crown are down. The circuit is yours.", "campaign", "Circuit complete");
    }
  } else {
    const boss = KNOCKOUT_BOSSES[campaign.bossIndex];
    saveCampaignProgress(null);
    mode = "result";
    showResult("Circuit lost", `${boss.name} shut down the run. Your next circuit starts from the first machine.`, "campaign", "Circuit result");
  }
}

function updateCampaign(delta) {
  campaignAccumulator += Math.min(0.25, Math.max(0, delta));
  while (campaignAccumulator >= FIXED_DELTA && mode === "campaign") {
    campaign = stepKnockoutState(applyKnockoutInputs(campaign, { host: currentInput() }));
    consumeEvents(campaign);
    campaignAccumulator -= FIXED_DELTA;
    if (campaign.phase === "ended") resolveCampaign();
  }
}

function updateOnline(delta) {
  if (!session) return;
  session.setLocalInput(mode === "multi" ? currentInput() : {});
  session.tick(delta);
  if (mode !== "multi") return;
  const state = session.getRenderState().state;
  consumeEvents(state);
  if (state.phase === "ended" && ui.result.hidden) {
    const own = sessionRole === "host" ? 0 : 1;
    showResult(state.winner === own ? "Match won" : "Match lost", "Host-confirmed best-of-three result.", "multi");
  }
}

function updateParticles(delta) {
  for (const particle of particles) {
    particle.life -= delta; particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vy += 480 * delta;
  }
  particles = particles.filter((particle) => particle.life > 0);
  shake *= Math.pow(0.015, delta);
}

function update(delta) {
  if (mode === "campaign") updateCampaign(delta);
  updateParticles(delta);
}

function renderState() {
  if (mode !== "multi" || !session) return campaign ?? createInitialKnockoutState({ mode: "campaign" });
  const frame = session.getRenderState(), state = frame.state;
  if (sessionRole === "client" && frame.interpolation.length > 1) {
    const target = state.tick - 6, samples = frame.interpolation;
    let left = samples[0], right = samples.at(-1);
    for (let index = 1; index < samples.length; index += 1) {
      if (samples[index].tick >= target) { left = samples[index - 1]; right = samples[index]; break; }
    }
    const alpha = Math.max(0, Math.min(1, (target - left.tick) / Math.max(1, right.tick - left.tick)));
    state.fighters[0].x = left.state.fighters[0].x + (right.state.fighters[0].x - left.state.fighters[0].x) * alpha;
  }
  if (sessionRole === "client" && frame.reconciliation?.sequence !== lastCorrectionSequence) {
    lastCorrectionSequence = frame.reconciliation?.sequence ?? lastCorrectionSequence;
    if (frame.reconciliation?.mode === "snap") display[1].x = state.fighters[1].x;
  }
  return state;
}

function arena() {
  const gradient = ctx.createLinearGradient(0, 0, 0, 540);
  gradient.addColorStop(0, "#071009"); gradient.addColorStop(0.62, "#172511"); gradient.addColorStop(1, "#030503");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 960, 540);
  ctx.save(); ctx.globalAlpha = 0.13; ctx.strokeStyle = "#baff51";
  for (let x = -200; x < 1160; x += 65) { ctx.beginPath(); ctx.moveTo(480, 170); ctx.lineTo(x, 540); ctx.stroke(); }
  for (let y = 220; y < 540; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = "#071008"; ctx.beginPath(); ctx.roundRect(55, 420, 850, 70, 22); ctx.fill();
  ctx.strokeStyle = "#d0a327"; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = "#1a2b14"; ctx.beginPath(); ctx.roundRect(75, 432, 810, 36, 16); ctx.fill();
  ctx.strokeStyle = "rgba(255,222,75,.45)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(480, 421); ctx.lineTo(480, 490); ctx.stroke();
}

function robot(fighter, index, time) {
  const x = display[index].x += (fighter.x - display[index].x) * 0.24;
  const face = index ? -1 : 1;
  const punch = fighter.punchTicks > 0 ? Math.sin((12 - fighter.punchTicks) / 12 * Math.PI) : 0;
  const hit = fighter.hitTicks > 0;
  ctx.save();
  ctx.translate(x - (hit ? face * 9 : 0), 395 + Math.sin(time * 4 + index) * 2);
  if (fighter.dead) ctx.rotate(face * 0.22);
  ctx.fillStyle = "#0006"; ctx.beginPath(); ctx.ellipse(0, 68, 66, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1a201a"; ctx.beginPath(); ctx.roundRect(-47, 23, 94, 48, 20); ctx.fill();
  ctx.fillStyle = fighter.trim; ctx.fillRect(-36, 38, 72, 7);
  ctx.fillStyle = fighter.color; ctx.beginPath(); ctx.roundRect(-38, -48, 76, 85, 18); ctx.fill();
  ctx.strokeStyle = fighter.trim; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = "#111a12"; ctx.beginPath(); ctx.roundRect(-28, -38, 56, 26, 9); ctx.fill();
  ctx.fillStyle = "#fff7a0"; ctx.beginPath(); ctx.arc(face * 15, -25, 5, 0, Math.PI * 2); ctx.fill();
  const hand = face * (82 + punch * Math.max(50, fighter.range - 50));
  ctx.strokeStyle = "#263027"; ctx.lineWidth = 17; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(face * 36, 0); ctx.lineTo(hand - face * 15, -2); ctx.stroke();
  ctx.fillStyle = fighter.color; ctx.beginPath(); ctx.arc(hand, -2, 20, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = fighter.trim; ctx.lineWidth = 4; ctx.stroke();
  if (fighter.windupTicks > 0) { ctx.strokeStyle = "#fff36c"; ctx.lineWidth = 3; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(0, -6, 63 + Math.sin(time * 25) * 4, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

function updateHud(state) {
  if (ui.hud.hidden) return;
  const [player, rival] = state.fighters;
  $("#p1Hp").textContent = Math.ceil(player.hp); $("#p2Hp").textContent = Math.ceil(rival.hp);
  $("#p1Fill").style.width = `${Math.max(0, player.hp / player.maxHp * 100)}%`;
  $("#p2Fill").style.width = `${Math.max(0, rival.hp / rival.maxHp * 100)}%`;
  $("#p1Name").textContent = player.name; $("#p2Name").textContent = rival.name;
  if (state.mode === "campaign") {
    $("#roundLabel").textContent = `${state.bossIndex + 1}/${KNOCKOUT_BOSSES.length}`;
    $("#phaseLabel").textContent = KNOCKOUT_BOSSES[state.bossIndex].tag;
  } else {
    $("#roundLabel").textContent = state.round;
    $("#phaseLabel").textContent = state.phase === "countdown" ? "Starting" : state.phase;
  }
}

function draw(now) {
  const state = renderState();
  ctx.save();
  if (shake > 1) ctx.translate((Math.sin(now * 0.071) * 0.5) * shake, (Math.cos(now * 0.093) * 0.5) * shake);
  arena();
  state.fighters.forEach((fighter, index) => robot(fighter, index, now / 1000));
  for (const particle of particles) { ctx.globalAlpha = Math.max(0, particle.life * 2); ctx.fillStyle = particle.color; ctx.fillRect(particle.x, particle.y, 4, 4); }
  ctx.restore(); ctx.globalAlpha = 1;
  updateHud(state);
}

function loop(now) {
  const delta = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  update(delta);
  draw(now);
  requestAnimationFrame(loop);
}

// Rendering may pause in a background tab, but transport messages still arrive.
// Pump the fixed multiplayer controller independently so a queued handshake can
// always reach the next deterministic simulation tick.
const networkTimer = setInterval(() => {
  const now = performance.now();
  const delta = Math.min(0.25, Math.max(0, (now - networkLast) / 1000));
  networkLast = now;
  updateOnline(delta);
}, 1000 / 60);

function setInput(name, on) {
  if (!(name in input)) return;
  if (name === "punch" && on && !input.punch && playing()) sound("swing");
  input[name] = Boolean(on);
}

function clearInput() {
  input = { left: false, right: false, punch: false };
  document.querySelectorAll("[data-control].active").forEach((button) => button.classList.remove("active"));
}

addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (["KeyA", "ArrowLeft", "KeyD", "ArrowRight", "Space", "KeyJ"].includes(event.code)) event.preventDefault();
  if (["KeyA", "ArrowLeft"].includes(event.code)) setInput("left", true);
  if (["KeyD", "ArrowRight"].includes(event.code)) setInput("right", true);
  if (["Space", "KeyJ"].includes(event.code)) setInput("punch", true);
});
addEventListener("keyup", (event) => {
  if (["KeyA", "ArrowLeft"].includes(event.code)) setInput("left", false);
  if (["KeyD", "ArrowRight"].includes(event.code)) setInput("right", false);
  if (["Space", "KeyJ"].includes(event.code)) setInput("punch", false);
});
addEventListener("blur", clearInput);
addEventListener("pagehide", () => { clearInterval(networkTimer); disposeSession(); });
addEventListener("pointerdown", unlockAudio, { capture: true });
addEventListener("keydown", unlockAudio, { capture: true });
document.addEventListener("visibilitychange", () => { if (document.hidden) clearInput(); });
document.querySelectorAll("[data-control]").forEach((button) => {
  const name = button.dataset.control;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault(); button.setPointerCapture?.(event.pointerId); button.classList.add("active"); setInput(name, true);
  });
  const release = (event) => { event.preventDefault(); button.classList.remove("active"); setInput(name, false); };
  button.addEventListener("pointerup", release); button.addEventListener("pointercancel", release); button.addEventListener("lostpointercapture", release);
});

$("#circuitBtn").onclick = continueCampaign;
$("#newCircuitBtn").onclick = startNewCampaign;
$("#onlineBtn").onclick = () => { mode = "lobby"; ui.actions.hidden = true; ui.lobby.hidden = false; setStatus("idle", "Choose Create or Join."); };
$("#hostBtn").onclick = host;
$("#joinBtn").onclick = join;
$("#copyBtn").onclick = async () => {
  if (!roomCode) { ui.net.textContent = "Create a room first."; return; }
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(roomCode);
    ui.net.textContent = "Room code copied.";
  } catch { ui.net.textContent = "Copy was blocked. Select the room code and copy it manually."; }
};
$("#backBtn").onclick = showMenu;
$("#resultMenuBtn").onclick = showMenu;
$("#resultBtn").onclick = () => {
  if (resultMode === "campaign") startNewCampaign();
  else { disposeSession(); mode = "lobby"; ui.result.hidden = true; ui.start.hidden = false; ui.actions.hidden = true; ui.lobby.hidden = false; ui.hud.hidden = true; setStatus("idle", "Create or join a fresh room."); }
};
$("#hostTab").onclick = () => { $("#hostPane").hidden = false; $("#joinPane").hidden = true; $("#hostTab").classList.add("selected"); $("#joinTab").classList.remove("selected"); $("#youRole").textContent = "You · Gold robot"; $("#rivalRole").textContent = "Rival · Orange robot"; };
$("#joinTab").onclick = () => { $("#hostPane").hidden = true; $("#joinPane").hidden = false; $("#joinTab").classList.add("selected"); $("#hostTab").classList.remove("selected"); $("#youRole").textContent = "You · Orange robot"; $("#rivalRole").textContent = "Rival · Gold robot"; };

refreshCampaignAction();
window.KnockoutCircuit = {
  version: "0.3.0",
  bosses: KNOCKOUT_BOSSES,
  createKnockoutSimulationAdapter,
  getState: () => structuredClone(mode === "multi" && session ? session.getRenderState().state : campaign),
  getUiState: () => ({ mode, status: ui.status.textContent, lobbyVisible: !ui.lobby.hidden, resultVisible: !ui.result.hidden, upgradeVisible: !ui.upgrade.hidden }),
  getNetworkState: () => session ? structuredClone(session.getStatus()) : null,
  setInput,
  startCampaign: continueCampaign,
  startNewCampaign,
  chooseUpgrade
};
window.dispatchEvent(new CustomEvent("knockout-circuit-ready"));
requestAnimationFrame(loop);
