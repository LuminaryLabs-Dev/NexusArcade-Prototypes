const clone = structuredClone;
const spawn = () => [{ side: 0, x: 300, hp: 100, cooldown: 0, punchTicks: 0, landed: false }, { side: 1, x: 660, hp: 100, cooldown: 0, punchTicks: 0, landed: false }];
export function createInitialKnockoutState({ authoritative = true } = {}) { return { schema: "knockout-circuit-state/2", authoritative, tick: 0, phase: "countdown", countdownTicks: 90, roundOverTicks: 0, round: 1, wins: [0, 0], fighters: spawn(), inputs: [{ move: 0, punch: false }, { move: 0, punch: false }], winner: null }; }
const semantic = (value = {}) => ({ move: Math.max(-1, Math.min(1, Number(value.move ?? ((value.right ? 1 : 0) - (value.left ? 1 : 0))) || 0)), punch: Boolean(value.punch) });
export function applyKnockoutInputs(state, inputs = {}) { const next = clone(state); if (inputs.host) next.inputs[0] = semantic(inputs.host); if (inputs.local) next.inputs[1] = semantic(inputs.local); return next; }
export function stepKnockoutState(state) {
  const next = clone(state); next.tick += 1;
  if (next.authoritative && next.phase === "countdown" && --next.countdownTicks <= 0) next.phase = "fight";
  const active = next.authoritative ? [0, 1] : [1];
  if (next.phase === "fight") for (const index of active) { const fighter = next.fighters[index], intent = next.inputs[index]; fighter.x += intent.move * 3; fighter.x = Math.max(index ? 490 : 110, Math.min(index ? 850 : 470, fighter.x)); fighter.cooldown = Math.max(0, fighter.cooldown - 1); fighter.punchTicks = Math.max(0, fighter.punchTicks - 1); if (intent.punch && fighter.cooldown === 0) { fighter.cooldown = 30; fighter.punchTicks = 12; fighter.landed = false; } }
  if (next.authoritative && next.phase === "fight") for (const index of [0, 1]) { const attacker = next.fighters[index], target = next.fighters[1 - index]; if (attacker.punchTicks === 6 && !attacker.landed) { attacker.landed = true; if (Math.abs(attacker.x - target.x) <= 138) target.hp = Math.max(0, target.hp - 12); if (target.hp === 0) { next.phase = "roundover"; next.roundOverTicks = 75; next.winner = index; } } }
  if (next.authoritative && next.phase === "roundover" && --next.roundOverTicks <= 0) { next.wins[next.winner] += 1; if (next.wins[next.winner] >= 2) next.phase = "ended"; else { next.round += 1; next.phase = "countdown"; next.countdownTicks = 75; next.fighters = spawn(); next.inputs = [{ move: 0, punch: false }, { move: 0, punch: false }]; next.winner = null; } }
  return next;
}
export function hashKnockoutState(state) { return JSON.stringify({ tick: state.tick, phase: state.phase, round: state.round, wins: state.wins, fighters: state.fighters }); }
export function createKnockoutSimulationAdapter({ authoritative = true } = {}) { return { createInitialState() { return createInitialKnockoutState({ authoritative }); }, captureState: clone, loadState(value) { return { ...clone(value), authoritative }; }, applyInputs: applyKnockoutInputs, step: stepKnockoutState, hashState: hashKnockoutState }; }
