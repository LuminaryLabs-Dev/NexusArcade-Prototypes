const KEY = new URLSearchParams(location.search).has('review') ? 'gothic-revolt-review-v1' : 'gothic-revolt-save-v1';
const SKILLS = new Set(['cleave','lunge','counter','whirl','break','rush','guillotine','lance','shield','burst','chain','decoy','prison','tempest','thorns','root','spore','vine','seed','totem','forest']);
const SLOTS = new Set(['weapon','offhand','helmet','chest','gloves','boots','charm']);
const STATS = new Set(['damage','health','speed','armor','crit','cooldown','gold']);

export function freshSave() {
  return { version: 1, gold: 0, threat: 1, expeditions: 0, kills: 0, inventory: [], equipped: {}, skills: {}, inventoryCap: 30 };
}

function finiteInt(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
}

function validItem(item) {
  return item && typeof item === 'object' && typeof item.id === 'string' && item.id.length <= 80 &&
    typeof item.name === 'string' && item.name.length <= 80 && SLOTS.has(item.slot) && STATS.has(item.stat) &&
    Number.isFinite(item.value) && item.value >= 1 && item.value <= 999 && Number.isFinite(item.tier) && item.tier >= 1 && item.tier <= 20;
}

function sanitize(value) {
  const clean = freshSave();
  if (!value || value.version !== 1 || typeof value !== 'object') return clean;
  clean.gold = finiteInt(value.gold, 0, 1_000_000_000, 0);
  clean.threat = finiteInt(value.threat, 1, 5, 1);
  clean.maxThreat = finiteInt(value.maxThreat, 1, 5, clean.threat);
  clean.selectedThreat = finiteInt(value.selectedThreat, 1, clean.maxThreat, 1);
  clean.expeditions = finiteInt(value.expeditions, 0, 1_000_000, 0);
  clean.kills = finiteInt(value.kills, 0, 1_000_000_000, 0);
  clean.inventoryCap = finiteInt(value.inventoryCap, 1, 100, 30);
  clean.inventory = Array.isArray(value.inventory) ? value.inventory.filter(validItem).slice(0, clean.inventoryCap).map(item => ({ ...item })) : [];
  const items = new Map(clean.inventory.map(item => [item.id, item]));
  if (value.equipped && typeof value.equipped === 'object') {
    for (const [slot, item] of Object.entries(value.equipped)) {
      if (SLOTS.has(slot) && validItem(item) && item.slot === slot) clean.equipped[slot] = items.get(item.id) || { ...item };
    }
  }
  if (value.skills && typeof value.skills === 'object') {
    for (const [id, rank] of Object.entries(value.skills)) if (SKILLS.has(id)) clean.skills[id] = finiteInt(rank, 0, 3, 0);
  }
  return clean;
}

export function loadSave() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    return sanitize(value);
  } catch { return freshSave(); }
}

export function storeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitize(save)));
    return true;
  } catch { return false; }
}

export function clearSave() {
  localStorage.removeItem(KEY);
}
