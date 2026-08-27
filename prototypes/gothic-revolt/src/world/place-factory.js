import { streamSeed } from '../simulation/seeded-random.js';
import { ROTWOOD_KIT } from '../art/rotwood-kit.js';

const PROP_LAYOUT = Object.freeze([
  ['elder-tree', -27, -17, true], ['elder-tree', 28, -15, true], ['elder-tree', -28, 19, true], ['elder-tree', 29, 20, true],
  ['root-cluster', -22, -22, false], ['root-cluster', 22, -23, false], ['root-cluster', -23, 24, false], ['root-cluster', 24, 25, false],
  ['fungus-cluster', -14, -20, false], ['fungus-cluster', 13, -20, false], ['fungus-cluster', -16, 21, false], ['fungus-cluster', 15, 22, false],
  ['lantern-post', -3, -3, false], ['lantern-post', 3, -3, false], ['lantern-post', -3, 3, false], ['lantern-post', 3, 3, false],
  ['shrine', 3, 3, false], ['broken-cart', 0, -3, false], ['well', 0, 3, false],
  ['fence', -24, -7, false], ['fence', -24, 0, false], ['fence', -24, 7, false],
  ['fence', 25, -7, false], ['fence', 25, 0, false], ['fence', 25, 7, false]
]);

export function createPlacePlan(macroX, macroY, anchor, state, worldSeed) {
  const central = macroX === 0 && macroY === 0;
  const theme = central || streamSeed(worldSeed, 'place-theme', macroX, macroY) % 4 === 0 ? 'rotwood' : 'legacy';
  const rotation = streamSeed(worldSeed, 'place-rotation', macroX, macroY) % 4;
  return {
    id: `place:${macroX}:${macroY}`,
    theme,
    kit: theme === 'rotwood' ? ROTWOOD_KIT.id : null,
    x: anchor.x,
    y: anchor.y,
    radius: theme === 'rotwood' ? 46 : 34,
    state,
    rotation,
    zones: theme === 'rotwood' ? [
      { id: 'village-square', kind: 'square', x: anchor.x, y: anchor.y, radius: 7 },
      { id: 'shrine-court', kind: 'landmark', x: anchor.x + 7, y: anchor.y + 7, radius: 4 },
      { id: 'fungal-grove', kind: 'grove', x: anchor.x - 21, y: anchor.y + 20, radius: 9 }
    ] : []
  };
}

export function buildingVisualSpec(place, macroX, macroY, index, worldSeed) {
  if (place.theme !== 'rotwood') return { theme: 'legacy', archetype: 'legacy', roofVariant: index % 5, materialVariant: index % 4 };
  const archetype = ROTWOOD_KIT.archetypes[index % ROTWOOD_KIT.archetypes.length];
  return {
    theme: 'rotwood',
    kit: ROTWOOD_KIT.id,
    archetype: archetype.id,
    roofKind: archetype.roof,
    roofVariant: streamSeed(worldSeed, 'rotwood-roof', macroX, macroY, index) % 8,
    materialVariant: streamSeed(worldSeed, 'rotwood-material', macroX, macroY, index) % 8,
    corruption: streamSeed(worldSeed, 'rotwood-corruption', macroX, macroY, index) % 4,
    lanterns: index % 3 !== 1
  };
}

export function placeProps(place, macroX, macroY, worldSeed) {
  if (place.theme !== 'rotwood') return [];
  return PROP_LAYOUT.map(([role, offsetX, offsetY, solid], index) => {
    const jitterX = Number(streamSeed(worldSeed, 'place-prop-x', macroX, macroY, index) % 3) - 1;
    const jitterY = Number(streamSeed(worldSeed, 'place-prop-y', macroX, macroY, index) % 3) - 1;
    return {
      id: `place-prop:${macroX}:${macroY}:${index}`,
      tileX: place.x + offsetX + jitterX,
      tileY: place.y + offsetY + jitterY,
      role,
      kind: role === 'elder-tree' ? 'tree' : role === 'shrine' ? 'shrine' : 'decoration',
      solid,
      theme: 'rotwood',
      variant: streamSeed(worldSeed, 'place-prop-variant', macroX, macroY, index) % 4
    };
  });
}
