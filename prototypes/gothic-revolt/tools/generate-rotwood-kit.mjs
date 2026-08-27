import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROTWOOD_KIT } from '../src/art/rotwood-kit.js';

const require = createRequire(import.meta.url);
const { createCanvas } = require('@napi-rs/canvas');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const atlasDir = resolve(root, 'assets/world/atlases');
const manifestDir = resolve(root, 'assets/world/manifests');
const reviewRoot = resolve(root, '../../../gothic-revolt-rotwood-review');
const candidateRoot = resolve(reviewRoot, 'candidates');
const TILE = 32;
const COLS = 16;
const ROWS = 16;
const selectedId = process.argv.find((value) => value.startsWith('--select='))?.split('=')[1] || 'c15';

const candidates = Object.freeze([
  { id: 'c11', label: 'Old-growth neutral', moss: 0.72, contrast: 0.86, decay: 0.28, warmth: 0.18, detail: 0.82 },
  { id: 'c12', label: 'Moss cathedral', moss: 1.00, contrast: 0.92, decay: 0.36, warmth: 0.16, detail: 0.96 },
  { id: 'c13', label: 'Lantern village', moss: 0.76, contrast: 0.94, decay: 0.25, warmth: 0.72, detail: 0.92 },
  { id: 'c14', label: 'Corrupted rot', moss: 0.82, contrast: 1.00, decay: 0.88, warmth: 0.24, detail: 1.00 },
  { id: 'c15', label: 'Curated Rotwood', moss: 0.92, contrast: 1.00, decay: 0.56, warmth: 0.52, detail: 1.00 }
]);

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

function px(ctx, x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function pixelLine(ctx, x0, y0, x1, y1, color, width = 1) {
  let x = Math.round(x0), y = Math.round(y0);
  const endX = Math.round(x1), endY = Math.round(y1);
  const dx = Math.abs(endX - x), sx = x < endX ? 1 : -1;
  const dy = -Math.abs(endY - y), sy = y < endY ? 1 : -1;
  let error = dx + dy;
  while (true) {
    px(ctx, x, y, width, width, color);
    if (x === endX && y === endY) break;
    const doubled = error * 2;
    if (doubled >= dy) { error += dy; x += sx; }
    if (doubled <= dx) { error += dx; y += sy; }
  }
}

function palette(candidate) {
  const p = ROTWOOD_KIT.palette;
  return {
    ...p,
    soilDeep: candidate.contrast > 0.95 ? '#0d130d' : p.soilDeep,
    moss: candidate.moss > 0.9 ? '#5c713d' : p.moss,
    mossLight: candidate.moss > 0.9 ? '#9aa45f' : p.mossLight,
    fungus: candidate.decay > 0.7 ? '#bd618f' : p.fungus,
    lantern: candidate.warmth > 0.5 ? '#eac36c' : p.lantern
  };
}

function tileOrigin(index) {
  return { x: index % COLS * TILE, y: Math.floor(index / COLS) * TILE };
}

function drawGround(ctx, index, ox, oy, rng, colors, candidate) {
  px(ctx, ox, oy, TILE, TILE, colors.soilDeep);
  const patchCount = 3 + (index % 3);
  for (let patch = 0; patch < patchCount; patch += 1) {
    const x = ox + 2 + Math.floor(rng() * 23);
    const y = oy + 2 + Math.floor(rng() * 23);
    const width = 5 + Math.floor(rng() * 9);
    const height = 3 + Math.floor(rng() * 6);
    px(ctx, x, y, width, height, patch % 2 ? colors.soil : colors.soilLift);
    px(ctx, x + 2, y, Math.max(2, width - 4), 1, colors.mossDeep);
    if (candidate.moss > 0.8 && patch % 2 === 0) px(ctx, x + 1, y + 1, Math.max(2, width - 3), 2, colors.moss);
  }
  for (let root = 0; root < 2; root += 1) {
    const x = ox + 4 + Math.floor(rng() * 22);
    const y = oy + 4 + Math.floor(rng() * 22);
    pixelLine(ctx, x, y, x + 4 + Math.floor(rng() * 7), y + (rng() > 0.5 ? 3 : -3), colors.barkDeep);
    px(ctx, x + 2, y - 1, 2, 1, colors.barkLight);
  }
  const details = Math.round(4 * candidate.detail);
  for (let dot = 0; dot < details; dot += 1) {
    const x = ox + 2 + Math.floor(rng() * 28);
    const y = oy + 2 + Math.floor(rng() * 28);
    px(ctx, x, y, dot % 2 ? 2 : 1, 1, dot % 3 ? colors.mossLight : colors.barkLight);
  }
}

function drawTransition(ctx, mask, ox, oy, rng, colors) {
  const ragged = (side) => {
    for (let step = 0; step < 8; step += 1) {
      const depth = 3 + Math.floor(rng() * 7);
      if (side === 1) px(ctx, ox + step * 4, oy, 5, depth, step % 2 ? colors.mossDeep : colors.moss);
      if (side === 2) px(ctx, ox + TILE - depth, oy + step * 4, depth, 5, step % 2 ? colors.mossDeep : colors.moss);
      if (side === 4) px(ctx, ox + step * 4, oy + TILE - depth, 5, depth, step % 2 ? colors.mossDeep : colors.moss);
      if (side === 8) px(ctx, ox, oy + step * 4, depth, 5, step % 2 ? colors.mossDeep : colors.moss);
    }
  };
  for (const side of [1, 2, 4, 8]) if (mask & side) ragged(side);
  for (let dot = 0; dot < 5; dot += 1) px(ctx, ox + Math.floor(rng() * 30), oy + Math.floor(rng() * 30), 2, 2, colors.mossLight);
}

function drawRoad(ctx, mask, ox, oy, rng, colors) {
  const north = mask & 1 ? 0 : 4;
  const east = mask & 2 ? 0 : 4;
  const south = mask & 4 ? 0 : 4;
  const west = mask & 8 ? 0 : 4;
  px(ctx, ox + west, oy + north, 32 - west - east, 32 - north - south, colors.mudDeep);
  const innerNorth = mask & 1 ? 0 : north + 2;
  const innerEast = mask & 2 ? 0 : east + 2;
  const innerSouth = mask & 4 ? 0 : south + 2;
  const innerWest = mask & 8 ? 0 : west + 2;
  px(ctx, ox + innerWest, oy + innerNorth, 32 - innerWest - innerEast, 32 - innerNorth - innerSouth, '#39362c');
  if (!(mask & 1)) for (let x = 2; x < 30; x += 5) px(ctx, ox + x, oy + north - (x % 3), 4, 3 + x % 3, '#474032');
  if (!(mask & 4)) for (let x = 2; x < 30; x += 5) px(ctx, ox + x, oy + 27 - (x % 2), 4, 4 + x % 2, '#474032');
  if (!(mask & 8)) for (let y = 3; y < 29; y += 5) px(ctx, ox + west - (y % 3), oy + y, 3 + y % 3, 4, '#474032');
  if (!(mask & 2)) for (let y = 3; y < 29; y += 5) px(ctx, ox + 27 - (y % 2), oy + y, 4 + y % 2, 4, '#474032');
  for (let stone = 0; stone < 5; stone += 1) {
    const x = ox + west + 2 + Math.floor(rng() * Math.max(1, 23 - west - east));
    const y = oy + north + 2 + Math.floor(rng() * Math.max(1, 23 - north - south));
    px(ctx, x, y, 5 + stone % 3, 3 + stone % 2, '#625846');
    px(ctx, x + 1, y, 3, 1, '#8e7c5d');
    px(ctx, x + 1, y + 3, 4, 1, colors.mudDeep);
  }
}

function drawFoundation(ctx, mask, ox, oy, rng, colors) {
  const stone = (x, y, width, height) => {
    px(ctx, x, y, width, height, '#252627');
    px(ctx, x + 1, y + 1, Math.max(1, width - 2), Math.max(1, height - 3), '#555551');
    px(ctx, x + 2, y + 1, Math.max(1, width - 4), 1, '#8a846f');
  };
  if (mask & 1) for (let x = 0; x < 32; x += 8) stone(ox + x, oy, 7, 7 + (x % 3));
  if (mask & 2) for (let y = 0; y < 32; y += 8) stone(ox + 25, oy + y, 7, 7);
  if (mask & 4) for (let x = 0; x < 32; x += 8) stone(ox + x, oy + 25, 7, 7);
  if (mask & 8) for (let y = 0; y < 32; y += 8) stone(ox, oy + y, 7, 7);
  if (mask === 0) stone(ox + 4, oy + 24, 24, 7);
}

function drawFloor(ctx, index, ox, oy, rng, colors, candidate) {
  px(ctx, ox, oy, 32, 32, '#211a14');
  const vertical = index & 1;
  for (let strip = 0; strip < 8; strip += 1) {
    const color = strip % 3 === 0 ? '#5c402d' : strip % 3 === 1 ? '#493225' : '#38281f';
    if (vertical) {
      px(ctx, ox + strip * 4, oy, 3, 32, color);
      px(ctx, ox + strip * 4, oy + 1, 1, 29, '#765139');
      px(ctx, ox + strip * 4, oy + (strip % 2 ? 10 : 21), 3, 1, '#17130f');
    } else {
      px(ctx, ox, oy + strip * 4, 32, 3, color);
      px(ctx, ox + 1, oy + strip * 4, 29, 1, '#765139');
      px(ctx, ox + (strip % 2 ? 10 : 21), oy + strip * 4, 1, 3, '#17130f');
    }
  }
  if (candidate.decay > 0.45) for (let i = 0; i < 4; i += 1) px(ctx, ox + 4 + Math.floor(rng() * 24), oy + 4 + Math.floor(rng() * 24), 3, 2, colors.mossDeep);
}

function drawWall(ctx, mask, ox, oy, rng, colors) {
  const wall = (x, y, width, height, horizontal) => {
    px(ctx, x, y, width, height, '#2a2119');
    px(ctx, x + 2, y + 2, Math.max(1, width - 4), Math.max(1, height - 4), '#67503b');
    if (horizontal) {
      for (let p = 3; p < width; p += 8) px(ctx, x + p, y, 2, height, colors.barkDeep);
      px(ctx, x, y, width, 2, colors.barkLight);
    } else {
      for (let p = 3; p < height; p += 8) px(ctx, x, y + p, width, 2, colors.barkDeep);
      px(ctx, x, y, 2, height, colors.barkLight);
    }
  };
  if (mask & 1) wall(ox, oy, 32, 9, true);
  if (mask & 2) wall(ox + 23, oy, 9, 32, false);
  if (mask & 4) wall(ox, oy + 23, 32, 9, true);
  if (mask & 8) wall(ox, oy, 9, 32, false);
}

function drawRoof(ctx, index, ox, oy, rng, colors, candidate) {
  const family = Math.floor(index / 8);
  const deep = family === 1 ? colors.barkDeep : family === 2 ? '#111219' : family === 3 ? '#20121d' : colors.slateDeep;
  const middle = family === 1 ? colors.bark : family === 2 ? '#343344' : family === 3 ? '#512a45' : colors.slate;
  const light = family === 1 ? colors.barkLight : family === 2 ? '#6e6f86' : family === 3 ? colors.fungus : colors.slateLight;
  px(ctx, ox, oy, 32, 32, deep);
  const rowOffset = index & 1 ? 4 : 0;
  for (let y = -2; y < 34; y += 7) {
    for (let x = -rowOffset; x < 34; x += 8) {
      px(ctx, ox + x, oy + y, 7, 6, (x + y + index) % 3 ? middle : deep);
      px(ctx, ox + x + 1, oy + y, 5, 1, light);
      px(ctx, ox + x, oy + y + 5, 7, 1, deep);
    }
  }
  const mossBands = Math.round(candidate.moss * 3);
  for (let i = 0; i < mossBands; i += 1) {
    const x = ox + Math.floor(rng() * 24);
    const y = oy + Math.floor(rng() * 25);
    px(ctx, x, y, 8 + i, 3, colors.mossDeep);
    px(ctx, x + 2, y, 5, 1, colors.mossLight);
  }
  if ((candidate.decay > 0.5 || family === 3) && index % 5 === 0) {
    pixelLine(ctx, ox + 6, oy + 4, ox + 18, oy + 18, '#140f13', 2);
    px(ctx, ox + 17, oy + 16, 5, 4, colors.fungus);
  }
}

function drawSingleProp(ctx, index, ox, oy, rng, colors, candidate) {
  ctx.clearRect(ox, oy, 32, 32);
  if (index >= 8 && index <= 11) {
    pixelLine(ctx, ox + 2, oy + 26, ox + 27, oy + 15, colors.barkDeep, 4);
    pixelLine(ctx, ox + 5, oy + 25, ox + 20, oy + 17, colors.barkLight, 1);
    for (let i = 0; i < 5; i += 1) px(ctx, ox + 5 + i * 5, oy + 18 - i % 2 * 3, 3, 3, colors.moss);
  } else if (index >= 12 && index <= 15) {
    for (let i = 0; i < 6; i += 1) {
      const x = ox + 4 + i * 4;
      const y = oy + 22 - (i % 3) * 3;
      px(ctx, x, y, 2, 7, '#c7b39d');
      px(ctx, x - 2, y - 2, 6, 3, i % 2 ? colors.fungus : colors.fungusLight);
    }
  } else if (index >= 16 && index <= 19) {
    px(ctx, ox + 14, oy + 8, 4, 22, colors.barkDeep);
    px(ctx, ox + 10, oy + 5, 12, 10, '#33251b');
    px(ctx, ox + 12, oy + 7, 8, 6, colors.lantern);
    px(ctx, ox + 14, oy + 8, 4, 3, colors.lanternLight);
  } else if (index >= 28 && index <= 31) {
    px(ctx, ox + 3, oy + 16, 26, 10, colors.bark);
    px(ctx, ox + 5, oy + 18, 22, 2, colors.barkLight);
    px(ctx, ox + 6, oy + 25, 6, 6, colors.barkDeep);
    px(ctx, ox + 21, oy + 25, 6, 6, colors.barkDeep);
    pixelLine(ctx, ox + 5, oy + 16, ox + 26, oy + 8, colors.barkDeep, 3);
  } else if (index >= 32 && index <= 35) {
    px(ctx, ox + 5, oy + 13, 22, 15, '#2a2927');
    px(ctx, ox + 7, oy + 10, 18, 6, '#777267');
    px(ctx, ox + 10, oy + 13, 12, 9, '#111513');
    px(ctx, ox + 5, oy + 24, 22, 4, colors.mossDeep);
  } else if (index >= 36 && index <= 39) {
    px(ctx, ox + 2, oy + 13, 30, 5, colors.bark);
    px(ctx, ox + 5, oy + 7, 4, 22, colors.barkDeep);
    px(ctx, ox + 23, oy + 7, 4, 22, colors.barkDeep);
    px(ctx, ox + 3, oy + 13, 26, 1, colors.barkLight);
  } else if (index >= 40 && index <= 47) {
    px(ctx, ox + 14, oy + 16, 5, 15, colors.barkDeep);
    for (let i = 0; i < 7; i += 1) {
      const x = ox + 4 + Math.floor(rng() * 22), y = oy + 4 + Math.floor(rng() * 16);
      px(ctx, x, y, 8, 6, i % 2 ? colors.moss : colors.mossDeep);
      px(ctx, x + 2, y, 4, 1, colors.mossLight);
    }
  } else if (index >= 48 && index <= 51) {
    px(ctx, ox + 4, oy + 19, 25, 11, '#292a28');
    px(ctx, ox + 8, oy + 13, 17, 9, '#4e514b');
    px(ctx, ox + 11, oy + 10, 9, 5, '#777969');
    px(ctx, ox + 7, oy + 18, 13, 2, colors.moss);
  } else if (index >= 60) {
    for (let i = 0; i < 8; i += 1) px(ctx, ox + 4 + Math.floor(rng() * 24), oy + 8 + Math.floor(rng() * 20), 3, 3, i % 2 ? colors.fungus : colors.mossLight);
  }
}

function drawTree64(ctx, variant, colors, candidate) {
  const rng = random(hash(`${ROTWOOD_KIT.seed}/tree/${variant}`));
  ctx.clearRect(0, 0, 64, 64);
  pixelLine(ctx, 31, 64, 28, 30, colors.barkDeep, 8);
  pixelLine(ctx, 31, 58, 14, 42, colors.barkDeep, 5);
  pixelLine(ctx, 33, 54, 50, 34, colors.barkDeep, 5);
  pixelLine(ctx, 29, 57, 26, 31, colors.barkLight, 2);
  for (let cluster = 0; cluster < 15; cluster += 1) {
    const x = 5 + Math.floor(rng() * 46), y = 3 + Math.floor(rng() * 34);
    const width = 11 + Math.floor(rng() * 10), height = 7 + Math.floor(rng() * 7);
    px(ctx, x, y, width, height, cluster % 3 ? colors.mossDeep : colors.moss);
    px(ctx, x + 3, y + 1, Math.max(3, width - 6), 2, colors.mossLight);
  }
  for (let i = 0; i < Math.round(8 * candidate.decay); i += 1) px(ctx, 8 + Math.floor(rng() * 48), 12 + Math.floor(rng() * 40), 4, 3, colors.fungus);
  pixelLine(ctx, 27, 60, 10, 63, colors.barkDeep, 4);
  pixelLine(ctx, 35, 60, 54, 63, colors.barkDeep, 4);
}

function drawShrine64(ctx, variant, colors) {
  ctx.clearRect(0, 0, 64, 64);
  px(ctx, 13, 52, 38, 10, '#252524');
  px(ctx, 18, 22, 9, 33, '#5c5a52');
  px(ctx, 38, 22, 9, 33, '#5c5a52');
  px(ctx, 15, 16, 35, 9, '#716c5f');
  px(ctx, 20, 10, 25, 8, '#484741');
  px(ctx, 29, 4, 7, 45, colors.barkDeep);
  px(ctx, 23, 18, 19, 4, colors.moss);
  px(ctx, 27, 30, 11, 13, colors.fungus);
  px(ctx, 30, 32, 5, 6, colors.fungusLight);
  pixelLine(ctx, 15, 55, 48, 46, colors.barkDeep, 3);
}

function drawGate64(ctx, variant, colors) {
  ctx.clearRect(0, 0, 64, 64);
  px(ctx, 4, 13, 9, 51, colors.barkDeep);
  px(ctx, 51, 13, 9, 51, colors.barkDeep);
  px(ctx, 7, 15, 3, 43, colors.barkLight);
  px(ctx, 54, 15, 3, 43, colors.barkLight);
  px(ctx, 9, 18, 46, 8, colors.bark);
  for (let bar = 0; bar < 4; bar += 1) pixelLine(ctx, 15 + bar * 10, 24, 14 + bar * 10, 59, colors.bark, 5);
  pixelLine(ctx, 12, 31, 54, 49, colors.barkLight, 3);
  for (let i = 0; i < 7; i += 1) px(ctx, 8 + i * 7, 15 + i % 2 * 4, 5, 3, i % 2 ? colors.fungus : colors.mossLight);
}

function slice64IntoAtlas(atlasCtx, source, baseIndex) {
  for (let index = 0; index < 4; index += 1) {
    const { x, y } = tileOrigin(baseIndex + index);
    atlasCtx.clearRect(x, y, 32, 32);
    atlasCtx.drawImage(source, index % 2 * 32, Math.floor(index / 2) * 32, 32, 32, x, y, 32, 32);
  }
}

function drawDetails(ctx, index, ox, oy, rng, colors) {
  ctx.clearRect(ox, oy, 32, 32);
  if (index === 2) {
    px(ctx, ox + 8, oy + 5, 14, 24, '#27221f');
    px(ctx, ox + 10, oy + 2, 10, 8, '#655148');
    px(ctx, ox + 11, oy + 6, 8, 4, '#171514');
    px(ctx, ox + 8, oy + 20, 14, 4, colors.mossDeep);
  } else if (index === 4 || index === 5) {
    px(ctx, ox + 5, oy + 2, 22, 30, colors.barkDeep);
    px(ctx, ox + 8, oy + 4, 16, 28, colors.bark);
    for (let y = 7; y < 30; y += 6) px(ctx, ox + 9, oy + y, 14, 2, colors.barkLight);
    px(ctx, ox + 19, oy + 18, 3, 3, colors.lantern);
    if (index === 5) pixelLine(ctx, ox + 8, oy + 7, ox + 23, oy + 25, '#151211', 2);
  } else if (index === 6 || index === 7) {
    px(ctx, ox + 3, oy + 5, 26, 22, colors.barkDeep);
    px(ctx, ox + 6, oy + 8, 20, 16, '#252e2a');
    px(ctx, ox + 8, oy + 10, 16, 11, '#6f8d80');
    px(ctx, ox + 9, oy + 10, 14, 2, '#b1c4ad');
    px(ctx, ox + 3, oy + 24, 26, 3, colors.moss);
  } else if (index >= 12 && index <= 16) {
    for (let i = 0; i < 8; i += 1) {
      const x = ox + 4 + Math.floor(rng() * 24), y = oy + 7 + Math.floor(rng() * 20);
      px(ctx, x, y, 3 + i % 3, 3, i % 2 ? colors.fungus : colors.moss);
      px(ctx, x + 1, y, 2, 1, i % 2 ? colors.fungusLight : colors.mossLight);
    }
  } else {
    for (let i = 0; i < 6; i += 1) px(ctx, ox + 4 + Math.floor(rng() * 24), oy + 5 + Math.floor(rng() * 22), 3, 2, i % 2 ? colors.barkLight : colors.moss);
  }
}

function drawEffects(ctx, index, ox, oy, rng, colors) {
  ctx.clearRect(ox, oy, 32, 32);
  for (let i = 0; i < 10; i += 1) {
    const angle = i / 10 * Math.PI * 2 + index * 0.31;
    const radius = 4 + i % 4 * 3;
    px(ctx, ox + 15 + Math.cos(angle) * radius, oy + 15 + Math.sin(angle) * radius, 2, 2, i % 3 ? colors.fungus : colors.lantern);
  }
  px(ctx, ox + 14, oy + 14, 5, 5, colors.lanternLight);
}

async function buildAtlas(candidate) {
  const canvas = createCanvas(COLS * TILE, ROWS * TILE);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const colors = palette(candidate);
  for (let index = 0; index < 16; index += 1) {
    const ground = tileOrigin(index);
    drawGround(ctx, index, ground.x, ground.y, random(hash(`${candidate.id}/ground/${index}`)), colors, candidate);
    const moss = tileOrigin(16 + index);
    drawTransition(ctx, index, moss.x, moss.y, random(hash(`${candidate.id}/moss/${index}`)), colors);
    const road = tileOrigin(32 + index);
    drawRoad(ctx, index, road.x, road.y, random(hash(`${candidate.id}/road/${index}`)), colors);
    const foundation = tileOrigin(48 + index);
    drawFoundation(ctx, index, foundation.x, foundation.y, random(hash(`${candidate.id}/foundation/${index}`)), colors);
    const floor = tileOrigin(64 + index);
    drawFloor(ctx, index, floor.x, floor.y, random(hash(`${candidate.id}/floor/${index}`)), colors, candidate);
    const wall = tileOrigin(80 + index);
    drawWall(ctx, index, wall.x, wall.y, random(hash(`${candidate.id}/wall/${index}`)), colors);
  }
  for (let index = 0; index < 32; index += 1) {
    const roof = tileOrigin(96 + index);
    drawRoof(ctx, index, roof.x, roof.y, random(hash(`${candidate.id}/roof/${index}`)), colors, candidate);
    const detail = tileOrigin(192 + index);
    drawDetails(ctx, index, detail.x, detail.y, random(hash(`${candidate.id}/detail/${index}`)), colors);
    const effect = tileOrigin(224 + index);
    drawEffects(ctx, index, effect.x, effect.y, random(hash(`${candidate.id}/effect/${index}`)), colors);
  }
  const prop64 = createCanvas(64, 64);
  const propCtx = prop64.getContext('2d');
  for (let variant = 0; variant < 2; variant += 1) {
    drawTree64(propCtx, variant, colors, candidate);
    slice64IntoAtlas(ctx, prop64, variant * 4);
    drawShrine64(propCtx, variant, colors);
    slice64IntoAtlas(ctx, prop64, 20 + variant * 4);
    drawGate64(propCtx, variant, colors);
    slice64IntoAtlas(ctx, prop64, 52 + variant * 4);
  }
  for (const index of [...Array(12).keys()].map((value) => value + 8)
    .concat([...Array(12).keys()].map((value) => value + 28))
    .concat([...Array(12).keys()].map((value) => value + 40))
    .concat([60, 61, 62, 63])) {
    const origin = tileOrigin(128 + index);
    drawSingleProp(ctx, index, origin.x, origin.y, random(hash(`${candidate.id}/prop/${index}`)), colors, candidate);
  }
  return { canvas, colors };
}

function drawAtlasTile(ctx, atlas, frame, x, y, width = 32, height = 32, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(atlas, frame % 16 * 32, Math.floor(frame / 16) * 32, 32, 32, Math.round(x), Math.round(y), width, height);
  ctx.restore();
}

function previewRoadMask(x, y, roads) {
  const key = (px, py) => roads.has(`${px},${py}`);
  return (key(x, y - 1) ? 1 : 0) | (key(x + 1, y) ? 2 : 0) | (key(x, y + 1) ? 4 : 0) | (key(x - 1, y) ? 8 : 0);
}

function drawPreviewBuilding(ctx, atlas, building) {
  const { x, y, width, height, variant, archetype } = building;
  ctx.fillStyle = 'rgba(4,6,5,.7)';
  ctx.fillRect(x + 14, y + 18, width * 32 + 18, height * 32 + 18);
  for (let ty = 0; ty < height; ty += 1) for (let tx = 0; tx < width; tx += 1) {
    const edge = (ty === 0 ? 1 : 0) | (tx === width - 1 ? 2 : 0) | (ty === height - 1 ? 4 : 0) | (tx === 0 ? 8 : 0);
    drawAtlasTile(ctx, atlas, 64 + ((tx * 3 + ty * 5 + variant) & 15), x + tx * 32, y + ty * 32);
    if (edge) drawAtlasTile(ctx, atlas, 48 + edge, x + tx * 32, y + ty * 32);
  }
  ctx.save();
  ctx.beginPath();
  if (archetype === 'chapel') {
    ctx.moveTo(x + width * 16, y - 18); ctx.lineTo(x + width * 32 + 10, y + 16); ctx.lineTo(x + width * 32, y + height * 32 + 12); ctx.lineTo(x, y + height * 32 + 12); ctx.lineTo(x - 10, y + 16);
  } else {
    ctx.moveTo(x + 10, y - 8); ctx.lineTo(x + width * 32 - 10, y - 8); ctx.lineTo(x + width * 32 + 10, y + 10); ctx.lineTo(x + width * 32, y + height * 32 + 12); ctx.lineTo(x, y + height * 32 + 12); ctx.lineTo(x - 10, y + 10);
  }
  ctx.closePath(); ctx.clip();
  for (let ty = -1; ty <= height; ty += 1) for (let tx = -1; tx <= width; tx += 1) drawAtlasTile(ctx, atlas, 96 + ((variant * 4 + tx + ty * 3) & 31), x + tx * 32, y + ty * 32);
  ctx.restore();
  ctx.strokeStyle = '#130f13'; ctx.lineWidth = 5; ctx.strokeRect(x + 3, y + 2, width * 32 - 6, height * 32 + 4);
  ctx.strokeStyle = '#8b6672'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + width * 16, y); ctx.lineTo(x + width * 16, y + height * 32); ctx.stroke();
}

async function buildPreview(candidate, atlas) {
  const canvas = createCanvas(960, 540);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const roads = new Set();
  for (let x = 0; x < 30; x += 1) for (let y = 7; y <= 9; y += 1) roads.add(`${x},${y}`);
  for (let y = 0; y < 17; y += 1) for (let x = 14; x <= 16; x += 1) roads.add(`${x},${y}`);
  for (let y = 0; y < 17; y += 1) for (let x = 5; x <= 6; x += 1) if (y >= 4 && y <= 8) roads.add(`${x},${y}`);
  for (let y = 0; y < 17; y += 1) for (let x = 24; x <= 25; x += 1) if (y >= 8 && y <= 13) roads.add(`${x},${y}`);
  for (let y = 0; y < 17; y += 1) for (let x = 0; x < 30; x += 1) {
    const variant = hash(`${candidate.id}/preview-ground/${x}/${y}`) & 15;
    drawAtlasTile(ctx, atlas, variant, x * 32, y * 32);
    if (roads.has(`${x},${y}`)) drawAtlasTile(ctx, atlas, 32 + previewRoadMask(x, y, roads), x * 32, y * 32);
  }
  drawPreviewBuilding(ctx, atlas, { x: 72, y: 37, width: 6, height: 5, variant: 1, archetype: 'cottage' });
  drawPreviewBuilding(ctx, atlas, { x: 647, y: 38, width: 7, height: 5, variant: 4, archetype: 'workshop' });
  drawPreviewBuilding(ctx, atlas, { x: 374, y: 300, width: 6, height: 6, variant: 6, archetype: 'chapel' });
  const props = [
    [0, 28, 474], [4, 863, 465], [20, 610, 304], [16, 452, 284], [28, 244, 330], [32, 731, 327], [36, 292, 178], [40, 41, 284], [44, 896, 276], [12, 351, 258], [13, 337, 278]
  ];
  for (const [frame, x, y] of props) {
    if ([0, 4, 20].includes(frame)) {
      drawAtlasTile(ctx, atlas, 128 + frame, x - 32, y - 64); drawAtlasTile(ctx, atlas, 129 + frame, x, y - 64); drawAtlasTile(ctx, atlas, 130 + frame, x - 32, y - 32); drawAtlasTile(ctx, atlas, 131 + frame, x, y - 32);
    } else drawAtlasTile(ctx, atlas, 128 + frame, x - 16, y - 28);
  }
  const vignette = ctx.createRadialGradient(480, 270, 160, 480, 270, 560);
  vignette.addColorStop(0, 'rgba(5,9,6,0)'); vignette.addColorStop(1, 'rgba(3,5,4,.66)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = 'rgba(7,10,8,.86)'; ctx.fillRect(18, 16, 310, 58);
  ctx.fillStyle = '#eee2c5'; ctx.font = 'bold 20px serif'; ctx.fillText(`ROTWOOD · ${candidate.id.toUpperCase()}`, 30, 40);
  ctx.fillStyle = '#b7aa8c'; ctx.font = '13px sans-serif'; ctx.fillText(candidate.label, 30, 61);
  return canvas;
}

await Promise.all([mkdir(atlasDir, { recursive: true }), mkdir(manifestDir, { recursive: true }), mkdir(candidateRoot, { recursive: true })]);
const built = new Map();
for (const candidate of candidates) {
  const candidateDir = resolve(candidateRoot, candidate.id);
  await mkdir(candidateDir, { recursive: true });
  const { canvas: atlas, colors } = await buildAtlas(candidate);
  const preview = await buildPreview(candidate, atlas);
  const atlasPng = await atlas.encode('png');
  const previewPng = await preview.encode('png');
  const encoding = {
    schema: 'gothic-revolt-rotwood-candidate/v1',
    candidateId: candidate.id,
    parentWinner: 'gothic-revolt-world-pass-06',
    seed: ROTWOOD_KIT.seed,
    parameters: candidate,
    tileSize: TILE,
    atlas: { columns: COLS, rows: ROWS, frameCount: COLS * ROWS, sha256: createHash('sha256').update(atlasPng).digest('hex') },
    preview: { width: 960, height: 540, sha256: createHash('sha256').update(previewPng).digest('hex') },
    palette: colors
  };
  await Promise.all([
    writeFile(resolve(candidateDir, 'atlas.png'), atlasPng),
    writeFile(resolve(candidateDir, 'preview.png'), previewPng),
    writeFile(resolve(candidateDir, 'encoding.json'), `${JSON.stringify(encoding, null, 2)}\n`)
  ]);
  built.set(candidate.id, { candidate, atlas, preview, atlasPng, previewPng, encoding });
}

if (!built.has(selectedId)) throw new Error(`Unknown selected candidate: ${selectedId}`);
const selected = built.get(selectedId);
const selectedWebp = await selected.atlas.encode('webp', 96);
await writeFile(resolve(atlasDir, 'rotwood.webp'), selectedWebp);

const tilesPath = resolve(manifestDir, 'tiles.json');
const tiles = JSON.parse(await readFile(tilesPath, 'utf8'));
const biomesPath = resolve(manifestDir, 'biomes.json');
const buildingsPath = resolve(manifestDir, 'buildings.json');
const townsPath = resolve(manifestDir, 'towns.json');
const biomes = JSON.parse(await readFile(biomesPath, 'utf8'));
const buildings = JSON.parse(await readFile(buildingsPath, 'utf8'));
const towns = JSON.parse(await readFile(townsPath, 'utf8'));
tiles.schema = 'gothic-revolt-tiles/v2';
tiles.atlases.rotwood = '../atlases/rotwood.webp';
tiles.atlasLayouts = Object.fromEntries(Object.keys(tiles.atlases).map((name) => [name, name === 'rotwood'
  ? { columns: COLS, rows: ROWS, frameCount: COLS * ROWS }
  : { columns: tiles.atlasColumns, rows: tiles.atlasRows, frameCount: tiles.atlasColumns * tiles.atlasRows }]));
tiles.frames = tiles.frames.filter((frame) => frame.atlas !== 'rotwood');
for (let index = 0; index < COLS * ROWS; index += 1) {
  const { x, y } = tileOrigin(index);
  tiles.frames.push({ id: `rotwood-${String(index).padStart(3, '0')}`, atlas: 'rotwood', index, x, y, width: 32, height: 32, seed: hash(`${ROTWOOD_KIT.seed}/rotwood/${index}`) });
}
const kitManifest = {
  schema: 'gothic-revolt-rotwood-kit/v1',
  id: ROTWOOD_KIT.id,
  seed: ROTWOOD_KIT.seed,
  selectedCandidate: selectedId,
  parameters: selected.candidate,
  atlas: '../atlases/rotwood.webp',
  atlasSha256: createHash('sha256').update(selectedWebp).digest('hex'),
  tileSize: TILE,
  frameGroups: ROTWOOD_KIT.frames,
  materialVocabulary: ['soil', 'moss', 'mud', 'roots', 'timber', 'stone', 'slate', 'fungus', 'lantern-light'],
  compositionVocabulary: ['ground', 'transitions', 'roads', 'foundations', 'floors', 'walls', 'roofs', 'props', 'details', 'effects'],
  buildingArchetypes: ROTWOOD_KIT.archetypes,
  placeZones: ['village-square', 'shrine-court', 'fungal-grove']
};
const rotwoodBiome = biomes.regions.find((region) => region.id === 'rotwood');
if (rotwoodBiome) Object.assign(rotwoodBiome, {
  kit: ROTWOOD_KIT.id,
  materials: kitManifest.materialVocabulary,
  pathFamily: 'rotwood-mud-and-cobble',
  placeFamilies: ['village-square', 'shrine-court', 'fungal-grove']
});
buildings.kits = {
  ...(buildings.kits || {}),
  [ROTWOOD_KIT.id]: {
    atlas: 'rotwood',
    archetypes: ROTWOOD_KIT.archetypes,
    layers: ['foundation', 'floor', 'wall', 'door-window', 'roof', 'corruption', 'lighting']
  }
};
towns.placeKits = {
  ...(towns.placeKits || {}),
  rotwood: {
    kit: ROTWOOD_KIT.id,
    zones: ['village-square', 'shrine-court', 'fungal-grove'],
    pathRule: 'door-to-town-cross',
    propClusters: ['elder-trees', 'root-clusters', 'fungus-clusters', 'lantern-court', 'shrine', 'well', 'fences']
  }
};
await Promise.all([
  writeFile(tilesPath, `${JSON.stringify(tiles, null, 2)}\n`),
  writeFile(biomesPath, `${JSON.stringify(biomes, null, 2)}\n`),
  writeFile(buildingsPath, `${JSON.stringify(buildings, null, 2)}\n`),
  writeFile(townsPath, `${JSON.stringify(towns, null, 2)}\n`),
  writeFile(resolve(manifestDir, 'rotwood-kit.json'), `${JSON.stringify(kitManifest, null, 2)}\n`)
]);

const contact = createCanvas(1920, 1080);
const contactCtx = contact.getContext('2d');
contactCtx.fillStyle = '#080b09'; contactCtx.fillRect(0, 0, 1920, 1080);
for (let index = 0; index < candidates.length; index += 1) {
  const candidate = candidates[index];
  const item = built.get(candidate.id);
  const column = index % 2, row = Math.floor(index / 2);
  const x = column * 960, y = row * 360;
  contactCtx.drawImage(item.preview, 0, 0, 960, 540, x, y, 960, 540);
  contactCtx.fillStyle = candidate.id === selectedId ? '#e7bd69' : '#bcb39d';
  contactCtx.font = 'bold 18px sans-serif';
  contactCtx.fillText(candidate.id === selectedId ? 'SELECTED' : 'CANDIDATE', x + 810, y + 30);
}
await writeFile(resolve(reviewRoot, 'contact-sheet.png'), await contact.encode('png'));
const run = {
  schema: 'iterative-asset-review/v1',
  run_id: 'rotwood-village-20260827-76100-v2',
  asset: { asset_id: 'rotwood-village-kit', kind: 'procedural-pixel-art-tileset', intended_use: 'gothic-revolt-runtime-world' },
  authority: { mutation_roots: [root, reviewRoot], external_writes: false },
  reference_set: { reference_ids: ['user-approved-aaa-pixel-art-direction'], locked_criteria: ['hidden-grid', 'material-readability', 'building-silhouette', 'path-cohesion', 'shared-lighting'] },
  budget: { batch_size: 5, max_attempts: 3, accepted_improvement_goal: 1 },
  capture_profile_id: 'rotwood-place-960x540-v1',
  baseline: 'gothic-revolt-world-pass-06',
  selectedCandidate: selectedId,
  candidates: candidates.map((candidate) => built.get(candidate.id).encoding),
  state: 'generated'
};
await writeFile(resolve(reviewRoot, 'review-run.json'), `${JSON.stringify(run, null, 2)}\n`);
console.log(JSON.stringify({ selected: selectedId, candidates: candidates.length, frames: 256, atlas: resolve(atlasDir, 'rotwood.webp'), contactSheet: resolve(reviewRoot, 'contact-sheet.png') }));
