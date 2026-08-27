import assert from 'node:assert/strict';

const values = new Map();
globalThis.location = { search: '?review' };
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key)
};

const { clearSave, freshSave, loadSave, storeSave } = await import('../prototypes/gothic-revolt/src/save-system.js?unit');
assert.deepEqual(loadSave(), freshSave());
values.set('gothic-revolt-review-v1', '{bad json');
assert.deepEqual(loadSave(), freshSave(), 'corrupt saves fall back safely');

const item = { id: 'loot-proof', name: 'Proof Blade', slot: 'weapon', stat: 'damage', value: 7, tier: 2 };
assert.equal(storeSave({ version: 1, gold: 80, maxThreat: 99, selectedThreat: 99, inventory: [item], equipped: { weapon: item }, skills: { break: 8, injected: 3 } }), true);
const restored = loadSave();
assert.equal(restored.gold, 80);
assert.equal(restored.maxThreat, 5);
assert.equal(restored.selectedThreat, 5);
assert.equal(restored.skills.break, 3);
assert.equal(restored.skills.injected, undefined);
assert.equal(restored.equipped.weapon.id, item.id);
clearSave();
assert.deepEqual(loadSave(), freshSave());
console.log('gothic-revolt save validation ok');
