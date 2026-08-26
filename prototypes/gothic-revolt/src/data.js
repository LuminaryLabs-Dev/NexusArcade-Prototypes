export const CHARACTER_RECIPES = Object.freeze({
  player: { id: 'human-melee-fighter', family: 'human', seed: 76101 },
  archer: { id: 'rotwood-archer', family: 'rotwood', seed: 76102 },
  caster: { id: 'bone-cult-caster', family: 'bone', seed: 76103 },
  brute: { id: 'bloodfen-brute', family: 'bloodfen', seed: 76104 },
  knight: { id: 'corrupted-jungle-knight', family: 'knight', seed: 76105 }
});

export const ENEMIES = Object.freeze({
  archer: { hp: 28, speed: 62, damage: 8, gold: 4, radius: 18, color: '#819345' },
  caster: { hp: 42, speed: 48, damage: 10, gold: 7, radius: 19, color: '#c8ba87' },
  brute: { hp: 105, speed: 42, damage: 18, gold: 13, radius: 27, color: '#a93449' },
  knight: { hp: 180, speed: 54, damage: 23, gold: 25, radius: 25, color: '#728287' }
});

export const TREES = Object.freeze([
  { id: 'steel', name: 'Steel Revolt', color: '#d9c16e', nodes: [
    ['cleave','Cleave','Wider primary strikes'],['lunge','Executioner’s Lunge','Dash damages enemies'],['counter','Countercut','Damage after being hit'],['whirl','Whirlwind','Improves ability four'],['break','Armor Break','Attacks reduce defense'],['rush','Blood Rush','Kills grant attack speed'],['guillotine','Guillotine','Critical damage below 30% health']
  ]},
  { id: 'grave', name: 'Gravecraft', color: '#bcb5e6', nodes: [
    ['lance','Bone Lance','Improves ability two'],['shield','Marrow Shield','Raises maximum health'],['burst','Corpse Burst','Dead enemies explode'],['chain','Grave Chain','Lances chain to another target'],['decoy','Skeleton Decoy','Dash leaves a decoy'],['prison','Ossuary Prison','Roots last longer'],['tempest','Bone Tempest','Periodic orbiting bones']
  ]},
  { id: 'rot', name: 'Rotcraft', color: '#aabc57', nodes: [
    ['thorns','Thorn Volley','Primary attacks add thorns'],['root','Root Snare','Improves ability three'],['spore','Spore Bloom','Poison lasts longer'],['vine','Vine Armor','Reduces incoming damage'],['seed','Parasitic Seed','Poisoned kills heal'],['totem','Rotwood Totem','Periodic allied shots'],['forest','Forest Revolt','Roots spread on kill']
  ]}
]);

export const SLOTS = ['weapon','offhand','helmet','chest','gloves','boots','charm'];
export const ITEM_NAMES = {
  weapon: ['Notched Falchion','Rotwood Axe','Marrow Blade'], offhand: ['Vine Buckler','Bone Focus','Rebel Lantern'],
  helmet: ['Thorn Hood','Ossuary Crown','Rust Visor'], chest: ['Bloodstained Coat','Rootmail','Grave Plate'],
  gloves: ['Executioner Wraps','Spore Grips','Marrow Gauntlets'], boots: ['Mire Treads','Rebel Boots','Rootbound Sabatons'],
  charm: ['Leech Sigil','Fungal Eye','Broken Saint']
};

export const BIOMES = [
  { name: 'Rotwood', ground: '#121a10', alt: '#1b2817', detail: '#314024' },
  { name: 'Ossuary', ground: '#1a1713', alt: '#262219', detail: '#49402e' },
  { name: 'Bloodfen', ground: '#190d12', alt: '#29111a', detail: '#542033' },
  { name: 'Mycelial Ruins', ground: '#111610', alt: '#1f2617', detail: '#41364b' }
];
