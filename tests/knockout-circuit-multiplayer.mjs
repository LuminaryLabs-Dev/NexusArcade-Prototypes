import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applyKnockoutInputs, createInitialKnockoutState, createKnockoutSimulationAdapter, hashKnockoutState, stepKnockoutState } from "../prototypes/knockout-circuit/simulation.mjs";
const replay = () => { let state = createInitialKnockoutState({ authoritative: true }); for (let tick = 0; tick < 240; tick += 1) { state = applyKnockoutInputs(state, { host: { move: tick < 100 ? 1 : 0, punch: tick % 31 === 0 }, local: { move: tick < 100 ? -1 : 0, punch: tick % 37 === 0 } }); state = stepKnockoutState(state); } return state; };
assert.equal(hashKnockoutState(replay()), hashKnockoutState(replay()));
let predicted = createInitialKnockoutState({ authoritative: false }); predicted.phase = "fight"; predicted = applyKnockoutInputs(predicted, { local: { move: -1, punch: true } }); predicted = stepKnockoutState(predicted); assert.equal(predicted.fighters[1].x, 657); assert.equal(predicted.fighters[0].x, 300); assert.equal(predicted.fighters[0].hp, 100);
const loaded = createKnockoutSimulationAdapter({ authoritative: false }).loadState(createInitialKnockoutState({ authoritative: true })); assert.equal(loaded.authoritative, false);
const html = await readFile(new URL("../prototypes/knockout-circuit/index.html", import.meta.url), "utf8"); assert.match(html, /NexusEngine@8a60167f/); assert.match(html, /NexusEngine-Kits@c808f29d/); assert.doesNotMatch(html, /reliable:true/); assert.match(html, /Create room/); assert.match(html, /Copy/);
console.log("knockout-circuit multiplayer proof ok");
