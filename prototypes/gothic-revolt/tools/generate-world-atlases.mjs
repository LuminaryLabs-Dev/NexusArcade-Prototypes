import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { createCanvas } = require('@napi-rs/canvas');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const atlasDir = resolve(root, 'assets/world/atlases');
const manifestDir = resolve(root, 'assets/world/manifests');
const reviewDir = resolve(root, '../../../gothic-revolt-world-review/atlas-candidates');
const TILE = 32;
const COLS = 8;
const ROWS = 4;
const SEED = 76100;

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) {
    result ^= char.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function rect(ctx, x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

const palettes = {
  ground: [
    ['#171713', '#24251b', '#3b3a27'], ['#11180f', '#1d2918', '#39482a'], ['#1b1813', '#2b281e', '#625b3f'],
    ['#190d12', '#2e131c', '#65283b'], ['#151719', '#242a2c', '#536067'], ['#100d14', '#21172a', '#4b3a62']
  ],
  road: ['#28241c', '#3b3427', '#5e523b', '#938065'],
  building: ['#191613', '#352a22', '#69503a', '#a17c55', '#d1b27a'],
  roof: ['#111012', '#26191c', '#3a2529', '#55323a', '#7a4c50'],
  interior: ['#171310', '#32271e', '#614935', '#987354', '#c6a177'],
  prop: ['#121511', '#28351e', '#536338', '#7d744a', '#a99b68'],
  effect: ['#1a0c13', '#6b1f3c', '#c7465c', '#e5bd72', '#efe4bd']
};

function drawGround(ctx, index, ox, oy, rng) {
  const colors = palettes.ground[Math.floor(index / 4) % palettes.ground.length];
  rect(ctx, ox, oy, TILE, TILE, colors[0]);
  for (let i = 0; i < 12; i += 1) {
    const x = ox + Math.floor(rng() * 29);
    const y = oy + Math.floor(rng() * 29);
    const width = 2 + Math.floor(rng() * 7);
    rect(ctx, x, y, width, rng() > 0.65 ? 2 : 1, i % 3 ? colors[1] : colors[2]);
  }
}

function drawRoad(ctx, index, ox, oy, rng) {
  drawGround(ctx, index % 24, ox, oy, rng);
  const vertical = index % 4 === 0 || index % 4 === 2;
  const horizontal = index % 4 === 1 || index % 4 === 2 || index % 7 === 0;
  if (vertical) rect(ctx, ox + 9, oy, 14, TILE, palettes.road[1]);
  if (horizontal) rect(ctx, ox, oy + 9, TILE, 14, palettes.road[1]);
  for (let i = 0; i < 8; i += 1) rect(ctx, ox + Math.floor(rng() * 29), oy + Math.floor(rng() * 29), 3, 2, palettes.road[2 + i % 2]);
}

function drawBuilding(ctx, index, ox, oy, rng) {
  const kind = index % 4;
  rect(ctx, ox, oy, TILE, TILE, palettes.building[0]);
  if (kind === 0) {
    rect(ctx, ox, oy + 4, TILE, 24, palettes.building[2]);
    for (let x = 2; x < 32; x += 7) rect(ctx, ox + x, oy + 5, 2, 22, palettes.building[3]);
  } else if (kind === 1) {
    rect(ctx, ox + 2, oy + 2, 28, 28, palettes.building[1]);
    rect(ctx, ox + 5, oy + 5, 22, 22, palettes.building[2]);
    rect(ctx, ox + 13, oy + 15, 7, 15, palettes.building[0]);
  } else if (kind === 2) {
    rect(ctx, ox, oy + 11, TILE, 10, palettes.building[3]);
    rect(ctx, ox + 4, oy + 13, 6, 6, '#9ab0a4');
    rect(ctx, ox + 22, oy + 13, 6, 6, '#9ab0a4');
  } else {
    for (let i = 0; i < 20; i += 1) rect(ctx, ox + Math.floor(rng() * 28), oy + Math.floor(rng() * 28), 4, 3, palettes.building[1 + i % 4]);
  }
}

function drawRoof(ctx, index, ox, oy, rng) {
  const style = Math.floor(index / 4) % 5;
  rect(ctx, ox, oy, TILE, TILE, palettes.roof[0]);
  rect(ctx, ox + 1, oy + 4, 30, 25, palettes.roof[1 + style % 3]);
  rect(ctx, ox + 1, oy + 27, 30, 3, palettes.roof[0]);
  for (let y = 6; y < 27; y += 5) {
    rect(ctx, ox + 2, oy + y, 28, 1, palettes.roof[3]);
    for (let x = (index + y) % 8; x < 29; x += 8) rect(ctx, ox + x, oy + y + 1, 2, 3, palettes.roof[2]);
  }
  rect(ctx, ox + 14, oy + 3, 4, 27, palettes.roof[4]);
  if (index % 6 === 0) rect(ctx, ox + 21, oy + 1, 6, 11, '#70554a');
}

function drawInterior(ctx, index, ox, oy, rng) {
  rect(ctx, ox, oy, TILE, TILE, palettes.interior[1]);
  if (index % 3 === 0) for (let y = 2; y < 32; y += 6) rect(ctx, ox, oy + y, TILE, 2, palettes.interior[2]);
  else for (let x = 2; x < 32; x += 6) rect(ctx, ox + x, oy, 2, TILE, palettes.interior[2]);
  for (let i = 0; i < 5; i += 1) rect(ctx, ox + Math.floor(rng() * 28), oy + Math.floor(rng() * 28), 3, 2, palettes.interior[3 + i % 2]);
}

function drawProp(ctx, index, ox, oy, rng) {
  const kind = index % 4;
  if (kind === 0) {
    rect(ctx, ox + 14, oy + 13, 5, 18, '#30261b');
    rect(ctx, ox + 7, oy + 5, 19, 7, palettes.prop[2]);
    rect(ctx, ox + 3, oy + 10, 27, 8, palettes.prop[3]);
  } else if (kind === 1) {
    rect(ctx, ox + 5, oy + 18, 23, 11, '#36343a');
    rect(ctx, ox + 9, oy + 11, 15, 9, '#55535b');
    rect(ctx, ox + 13, oy + 7, 7, 6, '#79747b');
  } else if (kind === 2) {
    rect(ctx, ox + 11, oy + 7, 11, 23, '#4b4232');
    rect(ctx, ox + 7, oy + 4, 19, 5, palettes.prop[4]);
    rect(ctx, ox + 14, oy + 1, 5, 28, palettes.prop[3]);
  } else {
    for (let i = 0; i < 9; i += 1) rect(ctx, ox + 5 + Math.floor(rng() * 23), oy + 9 + Math.floor(rng() * 20), 2 + i % 3, 2 + (i + 1) % 3, i % 2 ? '#a57bbb' : '#7d9c4d');
  }
}

function drawEffect(ctx, index, ox, oy, rng) {
  const color = palettes.effect[1 + index % 4];
  for (let i = 0; i < 12; i += 1) {
    const angle = i / 12 * Math.PI * 2 + index * 0.17;
    const radius = 4 + (i % 4) * 3;
    rect(ctx, ox + 15 + Math.cos(angle) * radius, oy + 15 + Math.sin(angle) * radius, 2 + i % 2, 2 + i % 2, color);
  }
  rect(ctx, ox + 14, oy + 14, 5, 5, palettes.effect[4]);
}

const drawers = { ground: drawGround, roads: drawRoad, buildings: drawBuilding, roofs: drawRoof, interiors: drawInterior, props: drawProp, effects: drawEffect };

async function generateAtlas(name) {
  const canvas = createCanvas(COLS * TILE, ROWS * TILE);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const frames = [];
  for (let index = 0; index < COLS * ROWS; index += 1) {
    const x = index % COLS * TILE;
    const y = Math.floor(index / COLS) * TILE;
    const seed = hash(`${SEED}/${name}/${index}`);
    drawers[name](ctx, index, x, y, random(seed));
    frames.push({ id: `${name}-${String(index).padStart(2, '0')}`, atlas: name, index, x, y, width: TILE, height: TILE, seed });
  }
  await writeFile(resolve(atlasDir, `${name}.webp`), await canvas.encode('webp', 90));
  await writeFile(resolve(reviewDir, `${name}.png`), await canvas.encode('png'));
  return frames;
}

await mkdir(atlasDir, { recursive: true });
await mkdir(manifestDir, { recursive: true });
await mkdir(reviewDir, { recursive: true });
const atlasNames = Object.keys(drawers);
const allFrames = [];
for (const name of atlasNames) allFrames.push(...await generateAtlas(name));

const tiles = {
  schema: 'gothic-revolt-tiles/v1',
  seed: SEED,
  tileSize: TILE,
  atlasColumns: COLS,
  atlasRows: ROWS,
  atlases: Object.fromEntries(atlasNames.map((name) => [name, `../atlases/${name}.webp`])),
  frames: allFrames
};
const biomes = {
  schema: 'gothic-revolt-biomes/v1',
  regions: ['spirelands', 'rotwood', 'bone-barrens', 'bloodfen', 'iron-march', 'black-verge'].map((id, index) => ({ id, groundFrames: [index * 4, index * 4 + 1, index * 4 + 2, index * 4 + 3] }))
};
const buildings = { schema: 'gothic-revolt-buildings/v1', styles: Array.from({ length: 5 }, (_, index) => ({ id: `style-${index}`, wallFrame: index * 4, roofFrames: [index * 4, index * 4 + 1, index * 4 + 2, index * 4 + 3], interiorFrames: [index * 4, index * 4 + 1, index * 4 + 2, index * 4 + 3] })) };
const towns = { schema: 'gothic-revolt-towns/v1', states: ['friendly', 'abandoned', 'occupied', 'corrupted', 'besieged'], macroChunks: 4, buildingLots: 10 };
await Promise.all([
  writeFile(resolve(manifestDir, 'tiles.json'), `${JSON.stringify(tiles, null, 2)}\n`),
  writeFile(resolve(manifestDir, 'biomes.json'), `${JSON.stringify(biomes, null, 2)}\n`),
  writeFile(resolve(manifestDir, 'buildings.json'), `${JSON.stringify(buildings, null, 2)}\n`),
  writeFile(resolve(manifestDir, 'towns.json'), `${JSON.stringify(towns, null, 2)}\n`)
]);

console.log(JSON.stringify({ seed: SEED, atlases: atlasNames.length, candidatesPerAtlas: COLS * ROWS, frames: allFrames.length, output: atlasDir }));
