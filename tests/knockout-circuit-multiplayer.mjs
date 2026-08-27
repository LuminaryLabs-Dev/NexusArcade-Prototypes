import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  KNOCKOUT_BOSSES,
  KNOCKOUT_UPGRADES,
  applyKnockoutInputs,
  createInitialKnockoutState,
  createKnockoutSimulationAdapter,
  hashKnockoutState,
  stepKnockoutState
} from "../prototypes/knockout-circuit/simulation.mjs";

const replay = () => {
  let state = createInitialKnockoutState({ authoritative: true });
  for (let tick = 0; tick < 240; tick += 1) {
    state = applyKnockoutInputs(state, {
      host: { move: tick < 100 ? 1 : 0, punch: tick % 31 === 0 },
      local: { move: tick < 100 ? -1 : 0, punch: tick % 37 === 0 }
    });
    state = stepKnockoutState(state);
  }
  return state;
};
assert.equal(hashKnockoutState(replay()), hashKnockoutState(replay()), "identical inputs replay identically");

let predicted = createInitialKnockoutState({ authoritative: false });
predicted.phase = "fight";
predicted = applyKnockoutInputs(predicted, { local: { move: -1, punch: true } });
predicted = stepKnockoutState(predicted);
assert.equal(predicted.fighters[1].x, 657, "guest predicts its own movement");
assert.equal(predicted.fighters[0].x, 300, "guest does not simulate the host");
assert.equal(predicted.fighters[0].hp, 100, "guest does not decide damage");

const loaded = createKnockoutSimulationAdapter({ authoritative: false }).loadState(createInitialKnockoutState({ authoritative: true }));
assert.equal(loaded.authoritative, false);
assert.throws(() => createKnockoutSimulationAdapter().loadState({ schema: "wrong" }), /Invalid Knockout/);

let rewound = createInitialKnockoutState({ authoritative: true });
rewound.phase = "fight"; rewound.fighters[0].x = 300; rewound.fighters[1].x = 600;
const historical = structuredClone(rewound); historical.fighters[0].x = 480;
for (let frame = 0; frame < 7; frame += 1) {
  rewound = applyKnockoutInputs(rewound, { local: { punch: frame === 0 } });
  rewound = stepKnockoutState(rewound, 1 / 60, frame, { authoritative: true, inputTicks: { local: 10 }, getHistoricalState: () => historical });
}
assert.ok(rewound.fighters[0].hp < 100, "host rewind validates a delayed guest punch against bounded historical position");

assert.deepEqual(KNOCKOUT_BOSSES.map((boss) => boss.name), ["Boiler Bruiser", "Volt Viper", "Iron Warden", "Phantom Gear", "Crown Crusher"]);
assert.deepEqual(new Set(KNOCKOUT_BOSSES.map((boss) => boss.pattern)), new Set(["jab", "double", "charge", "counter", "fury"]));
assert.deepEqual(KNOCKOUT_UPGRADES.map((upgrade) => upgrade.id), ["power", "armor", "drive"]);
const upgraded = createInitialKnockoutState({ mode: "campaign", bossIndex: 2, upgrades: { power: 2, armor: 1, drive: 1 } });
assert.equal(upgraded.winTarget, 1, "campaign bosses remain single fights");
assert.equal(upgraded.fighters[0].damage, 22);
assert.equal(upgraded.fighters[0].maxHp, 115);
assert.equal(upgraded.fighters[0].speed, 3.3);
assert.equal(upgraded.fighters[1].name, "Iron Warden");

for (let bossIndex = 0; bossIndex < KNOCKOUT_BOSSES.length; bossIndex += 1) {
  let state = createInitialKnockoutState({ mode: "campaign", bossIndex, upgrades: { power: Math.min(3, bossIndex) } });
  for (let tick = 0; tick < 1800 && state.phase !== "ended"; tick += 1) {
    state = stepKnockoutState(applyKnockoutInputs(state, { host: { move: 1, punch: true } }));
  }
  assert.equal(state.phase, "ended", `${KNOCKOUT_BOSSES[bossIndex].name} can complete deterministically`);
}

const html = await readFile(new URL("../prototypes/knockout-circuit/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../prototypes/knockout-circuit/app.mjs", import.meta.url), "utf8");
assert.match(html, /NexusEngine@8a60167f/);
assert.match(html, /NexusEngine-Kits@2aeaa2b/);
assert.match(html, /multiplayer-host-kit\/controller\.js/, "browser loads the lean controller without the full NexusEngine bootstrap");
assert.doesNotMatch(html, /reliable:true/);
assert.match(html, /Create room/);
assert.match(html, /Copy/);
assert.match(html, /Install one upgrade/);
assert.match(html, /Invite link/);
assert.match(html, /Forfeit/);
assert.match(html, /Ready/);
assert.match(app, /import\("nexus-kits-host"\)/, "campaign boot does not require the network Kit");
assert.match(app, /visibilitychange/);
assert.match(app, /preventDefault/);
assert.match(app, /knockout-circuit-campaign\/1/);
assert.match(app, /requestRematch/);
assert.match(app, /recoveryGraceTicks/);
console.log("knockout-circuit multiplayer and campaign proof ok");
