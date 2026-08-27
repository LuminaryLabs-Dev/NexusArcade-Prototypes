export const ROTWOOD_KIT = Object.freeze({
  id: 'rotwood-village-v1',
  seed: 76100,
  atlas: 'rotwood',
  tileSize: 32,
  palette: Object.freeze({
    void: '#090d0a',
    soilDeep: '#111710',
    soil: '#1b2418',
    soilLift: '#2d3420',
    mossDeep: '#26331b',
    moss: '#53663a',
    mossLight: '#879357',
    mudDeep: '#1a1712',
    mud: '#3c3224',
    mudLight: '#756047',
    barkDeep: '#17130f',
    bark: '#4b3527',
    barkLight: '#886043',
    slateDeep: '#18151a',
    slate: '#493a48',
    slateLight: '#806171',
    fungus: '#a6729b',
    fungusLight: '#d1a0ba',
    lantern: '#e2b768',
    lanternLight: '#ffe1a0'
  }),
  frames: Object.freeze({
    ground: Object.freeze({ start: 0, count: 16 }),
    moss: Object.freeze({ start: 16, count: 16 }),
    roads: Object.freeze({ start: 32, count: 16 }),
    foundations: Object.freeze({ start: 48, count: 16 }),
    floors: Object.freeze({ start: 64, count: 16 }),
    walls: Object.freeze({ start: 80, count: 16 }),
    roofs: Object.freeze({ start: 96, count: 32 }),
    props: Object.freeze({ start: 128, count: 64 }),
    details: Object.freeze({ start: 192, count: 32 }),
    effects: Object.freeze({ start: 224, count: 32 })
  }),
  archetypes: Object.freeze([
    Object.freeze({ id: 'root-cottage', minWidth: 6, maxWidth: 7, minHeight: 5, maxHeight: 6, roof: 'moss-gable' }),
    Object.freeze({ id: 'fungal-workshop', minWidth: 7, maxWidth: 8, minHeight: 5, maxHeight: 6, roof: 'broken-hip' }),
    Object.freeze({ id: 'thorn-chapel', minWidth: 6, maxWidth: 7, minHeight: 6, maxHeight: 7, roof: 'spire-gable' })
  ])
});

export function rotwoodFrame(group, offset = 0) {
  const range = ROTWOOD_KIT.frames[group];
  if (!range) throw new Error(`Unknown Rotwood frame group: ${group}`);
  return range.start + (((offset % range.count) + range.count) % range.count);
}
