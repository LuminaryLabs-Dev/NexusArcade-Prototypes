const clone = structuredClone;
const round = (value) => Math.round(value * 1000) / 1000;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const KNOCKOUT_BOSSES = Object.freeze([
  Object.freeze({ name: "Boiler Bruiser", color: "#f14b27", trim: "#ffc13b", hp: 86, speed: 2.5, damage: 12, range: 127, cooldownTicks: 49, pattern: "jab", tag: "Measured single jabs" }),
  Object.freeze({ name: "Volt Viper", color: "#9bdc28", trim: "#ffe55b", hp: 96, speed: 2.967, damage: 10, range: 132, cooldownTicks: 41, pattern: "double", tag: "Fast double taps" }),
  Object.freeze({ name: "Iron Warden", color: "#667486", trim: "#ffbd35", hp: 112, speed: 2.333, damage: 17, range: 148, cooldownTicks: 59, pattern: "charge", tag: "Long-range charged fists" }),
  Object.freeze({ name: "Phantom Gear", color: "#8e57db", trim: "#66f1e7", hp: 106, speed: 3.417, damage: 14, range: 130, cooldownTicks: 35, pattern: "counter", tag: "Evasive counterpunches" }),
  Object.freeze({ name: "Crown Crusher", color: "#d62028", trim: "#ffdb39", hp: 130, speed: 3.2, damage: 17, range: 145, cooldownTicks: 30, pattern: "fury", tag: "Relentless triple combos" })
]);

export const KNOCKOUT_UPGRADES = Object.freeze([
  Object.freeze({ id: "power", name: "Piston Force", copy: "+4 punch damage" }),
  Object.freeze({ id: "armor", name: "Impact Shell", copy: "+15 max health" }),
  Object.freeze({ id: "drive", name: "Rail Drive", copy: "+18 movement speed" })
]);

const normalUpgrades = (value = {}) => ({
  power: clamp(Math.floor(Number(value.power) || 0), 0, 3),
  armor: clamp(Math.floor(Number(value.armor) || 0), 0, 3),
  drive: clamp(Math.floor(Number(value.drive) || 0), 0, 3)
});

function fighter(side, profile = {}) {
  const hp = Number(profile.hp ?? 100);
  return {
    side,
    x: side === 0 ? 300 : 660,
    hp,
    maxHp: hp,
    name: profile.name ?? (side === 0 ? "Spark" : "Rivet"),
    color: profile.color ?? (side === 0 ? "#e9b41e" : "#ed4827"),
    trim: profile.trim ?? (side === 0 ? "#fff08a" : "#ffc33c"),
    speed: Number(profile.speed ?? 3),
    damage: Number(profile.damage ?? 14),
    range: Number(profile.range ?? 132),
    cooldownTicks: Math.max(1, Math.floor(Number(profile.cooldownTicks ?? 43))),
    damageReduction: clamp(Number(profile.damageReduction ?? 0), 0, 0.5),
    pattern: profile.pattern ?? null,
    cooldown: 0,
    punchTicks: 0,
    hitTicks: 0,
    landed: false,
    knockback: 0,
    combo: 0,
    windupTicks: 0,
    charged: false,
    dead: false
  };
}

function profiles(mode, bossIndex, upgrades) {
  const player = fighter(0, {
    name: mode === "campaign" ? "Spark" : "Gold · Host",
    hp: 100 + upgrades.armor * 15,
    speed: 3 + upgrades.drive * 0.3,
    damage: 14 + upgrades.power * 4,
    range: 132,
    cooldownTicks: 43,
    damageReduction: upgrades.armor * 0.07
  });
  const rival = mode === "campaign"
    ? fighter(1, KNOCKOUT_BOSSES[bossIndex])
    : fighter(1, { name: "Orange · Guest", hp: 100, speed: 3, damage: 14, range: 132, cooldownTicks: 43 });
  return [player, rival];
}

export function createInitialKnockoutState({ authoritative = true, mode = "multiplayer", bossIndex = 0, upgrades = {} } = {}) {
  const safeMode = mode === "campaign" ? "campaign" : "multiplayer";
  const safeBoss = clamp(Math.floor(Number(bossIndex) || 0), 0, KNOCKOUT_BOSSES.length - 1);
  const safeUpgrades = normalUpgrades(upgrades);
  return {
    schema: "knockout-circuit-state/3",
    authoritative,
    mode: safeMode,
    bossIndex: safeBoss,
    upgrades: safeUpgrades,
    tick: 0,
    phase: "countdown",
    countdownTicks: 90,
    roundOverTicks: 0,
    round: 1,
    wins: [0, 0],
    winTarget: safeMode === "campaign" ? 1 : 2,
    fighters: profiles(safeMode, safeBoss, safeUpgrades),
    inputs: [{ move: 0, punch: false }, { move: 0, punch: false }],
    winner: null,
    eventSequence: 0,
    events: []
  };
}

const semantic = (value = {}) => ({
  move: clamp(Number(value.move ?? ((value.right ? 1 : 0) - (value.left ? 1 : 0))) || 0, -1, 1),
  punch: Boolean(value.punch)
});

export function applyKnockoutInputs(state, inputs = {}) {
  const next = clone(state);
  if (inputs.host) next.inputs[0] = semantic(inputs.host);
  if (inputs.local) next.inputs[1] = semantic(inputs.local);
  return next;
}

function bossIntent(state) {
  const boss = state.fighters[1], player = state.fighters[0];
  const distance = boss.x - player.x;
  const ideal = Math.min(boss.range * 0.78, player.range * 0.82);
  let move = 0, punch = false;
  if (boss.pattern === "counter" && player.punchTicks > 9) move = 1;
  else if (distance > ideal + 16) move = -1;
  else if (distance < ideal - 30) move = 1;
  const ready = boss.cooldown === 0;
  if (boss.pattern === "jab" && ready && distance <= boss.range && state.tick % 66 === 0) punch = true;
  if (boss.pattern === "double" && ready && distance <= boss.range) {
    if (boss.combo > 0) { punch = true; boss.combo -= 1; }
    else if (state.tick % 72 === 0) { punch = true; boss.combo = 1; }
  }
  if (boss.pattern === "charge") {
    if (ready && distance <= boss.range + 25 && boss.windupTicks === 0 && state.tick % 84 === 0) boss.windupTicks = 29;
    if (boss.windupTicks > 0) {
      move = 1;
      boss.windupTicks -= 1;
      if (boss.windupTicks === 0) { boss.charged = true; punch = true; move = 0; }
    }
  }
  if (boss.pattern === "counter" && ready && distance <= boss.range && player.punchTicks >= 4 && player.punchTicks <= 10) punch = true;
  if (boss.pattern === "fury" && ready && distance <= boss.range) {
    if (boss.combo > 0) { punch = true; boss.combo -= 1; }
    else if (state.tick % (boss.hp < boss.maxHp * 0.45 ? 42 : 60) === 0) { punch = true; boss.combo = 2; }
  }
  return { move, punch };
}

function pushEvent(state, type, data = {}) {
  state.eventSequence += 1;
  state.events.push({ id: state.eventSequence, tick: state.tick, type, ...data });
  state.events = state.events.filter((event) => state.tick - event.tick <= 12).slice(-8);
}

function moveFighter(fighterValue, intent) {
  fighterValue.cooldown = Math.max(0, fighterValue.cooldown - 1);
  fighterValue.punchTicks = Math.max(0, fighterValue.punchTicks - 1);
  fighterValue.hitTicks = Math.max(0, fighterValue.hitTicks - 1);
  const fury = fighterValue.pattern === "fury" && fighterValue.hp < fighterValue.maxHp * 0.45;
  const speed = fury ? 3.833 : fighterValue.speed;
  fighterValue.x = round(fighterValue.x + intent.move * speed + fighterValue.knockback);
  fighterValue.knockback = round(fighterValue.knockback * 0.72);
  if (Math.abs(fighterValue.knockback) < 0.05) fighterValue.knockback = 0;
  fighterValue.x = clamp(fighterValue.x, fighterValue.side ? 490 : 110, fighterValue.side ? 850 : 470);
  if (intent.punch && fighterValue.cooldown === 0 && !fighterValue.dead) {
    const furyCooldown = fury ? 20 : fighterValue.cooldownTicks;
    fighterValue.cooldown = furyCooldown;
    fighterValue.punchTicks = 12;
    fighterValue.landed = false;
  }
}

function resolveHit(state, index) {
  const attacker = state.fighters[index], target = state.fighters[1 - index];
  if (attacker.punchTicks !== 6 || attacker.landed || attacker.dead || target.dead) return;
  attacker.landed = true;
  const range = attacker.charged ? Math.max(attacker.range, 164) : attacker.range;
  if (Math.abs(attacker.x - target.x) > range) { attacker.charged = false; return; }
  const rawDamage = attacker.charged ? Math.max(attacker.damage, 23) : attacker.damage;
  const damage = Math.max(1, Math.round(rawDamage * (1 - target.damageReduction)));
  attacker.charged = false;
  target.hp = Math.max(0, target.hp - damage);
  target.hitTicks = 12;
  target.knockback = index === 0 ? 7.5 : -7.5;
  pushEvent(state, "hit", { attacker: index, target: 1 - index, damage, x: round((attacker.x + target.x) / 2) });
  if (target.hp === 0) {
    target.dead = true;
    state.phase = "roundover";
    state.roundOverTicks = 75;
    state.winner = index;
    pushEvent(state, "ko", { winner: index });
  }
}

function resetRound(state) {
  state.round += 1;
  state.phase = "countdown";
  state.countdownTicks = 75;
  state.fighters = profiles(state.mode, state.bossIndex, state.upgrades);
  state.inputs = [{ move: 0, punch: false }, { move: 0, punch: false }];
  state.winner = null;
  pushEvent(state, "round", { round: state.round });
}

export function stepKnockoutState(state) {
  const next = clone(state);
  next.tick += 1;
  next.events = next.events.filter((event) => next.tick - event.tick <= 12);

  if (next.authoritative && next.phase === "countdown") {
    next.countdownTicks -= 1;
    if (next.countdownTicks <= 0) {
      next.phase = "fight";
      pushEvent(next, "fight");
    }
  }

  if (next.phase === "fight") {
    if (next.authoritative && next.mode === "campaign") next.inputs[1] = bossIntent(next);
    const active = next.authoritative ? [0, 1] : [1];
    for (const index of active) moveFighter(next.fighters[index], next.inputs[index]);
    if (next.authoritative) {
      resolveHit(next, 0);
      resolveHit(next, 1);
    }
  }

  if (next.authoritative && next.phase === "roundover") {
    next.roundOverTicks -= 1;
    if (next.roundOverTicks <= 0) {
      next.wins[next.winner] += 1;
      if (next.wins[next.winner] >= next.winTarget) {
        next.phase = "ended";
        pushEvent(next, "ended", { winner: next.winner });
      } else resetRound(next);
    }
  }
  return next;
}

export function hashKnockoutState(state) {
  return JSON.stringify({
    schema: state.schema,
    mode: state.mode,
    bossIndex: state.bossIndex,
    upgrades: state.upgrades,
    tick: state.tick,
    phase: state.phase,
    countdownTicks: state.countdownTicks,
    roundOverTicks: state.roundOverTicks,
    round: state.round,
    wins: state.wins,
    winTarget: state.winTarget,
    fighters: state.fighters,
    winner: state.winner,
    eventSequence: state.eventSequence,
    events: state.events
  });
}

export function createKnockoutSimulationAdapter(options = {}) {
  const authoritative = options.authoritative !== false;
  const initial = {
    mode: options.mode ?? "multiplayer",
    bossIndex: options.bossIndex ?? 0,
    upgrades: options.upgrades ?? {}
  };
  return {
    createInitialState() { return createInitialKnockoutState({ ...initial, authoritative }); },
    captureState: clone,
    loadState(value) {
      if (!value || value.schema !== "knockout-circuit-state/3" || !Array.isArray(value.fighters) || value.fighters.length !== 2) {
        throw new TypeError("Invalid Knockout Circuit snapshot.");
      }
      return { ...clone(value), authoritative };
    },
    applyInputs: applyKnockoutInputs,
    step: stepKnockoutState,
    hashState: hashKnockoutState
  };
}
