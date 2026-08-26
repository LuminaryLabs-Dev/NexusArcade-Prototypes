const KEY = new URLSearchParams(location.search).has('review') ? 'gothic-revolt-review-v1' : 'gothic-revolt-save-v1';

export function freshSave() {
  return { version: 1, gold: 0, threat: 1, expeditions: 0, kills: 0, inventory: [], equipped: {}, skills: {}, inventoryCap: 30 };
}

export function loadSave() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    return value?.version === 1 ? { ...freshSave(), ...value } : freshSave();
  } catch { return freshSave(); }
}

export function storeSave(save) {
  localStorage.setItem(KEY, JSON.stringify(save));
}

export function clearSave() {
  localStorage.removeItem(KEY);
}
