import { streamSeed } from '../simulation/seeded-random.js';
import { WORLD_CONFIG } from './world-config.js';

const MACRO_TILES = WORLD_CONFIG.macroChunks * WORLD_CONFIG.chunkTiles;

export function townAnchor(macroX, macroY, worldSeed = WORLD_CONFIG.seed) {
  if (macroX === 0 && macroY === 0) return { x: 18, y: 18, central: true };
  const inset = 28;
  const span = MACRO_TILES - inset * 2;
  return {
    x: macroX * MACRO_TILES + inset + (streamSeed(worldSeed, 'town-x', macroX, macroY) % span),
    y: macroY * MACRO_TILES + inset + (streamSeed(worldSeed, 'town-y', macroX, macroY) % span),
    central: false
  };
}

function between(value, start, end, width = 1) {
  return value >= Math.min(start, end) - width && value <= Math.max(start, end) + width;
}

export function roadAt(globalTileX, globalTileY, worldSeed = WORLD_CONFIG.seed) {
  const macroX = Math.floor(globalTileX / MACRO_TILES);
  const macroY = Math.floor(globalTileY / MACRO_TILES);
  const center = townAnchor(macroX, macroY, worldSeed);
  const east = townAnchor(macroX + 1, macroY, worldSeed);
  const south = townAnchor(macroX, macroY + 1, worldSeed);
  const west = townAnchor(macroX - 1, macroY, worldSeed);
  const north = townAnchor(macroX, macroY - 1, worldSeed);
  const width = Math.abs(globalTileX) < 3 || Math.abs(globalTileY) < 3 ? 2 : 1;
  const townCross = (
    (Math.abs(globalTileY - center.y) <= 1 && between(globalTileX, center.x - 30, center.x + 30, 0))
    || (Math.abs(globalTileX - center.x) <= 1 && between(globalTileY, center.y - 30, center.y + 30, 0))
  );
  const spireLink = (
    (Math.abs(globalTileY) <= 1 && between(globalTileX, 0, townAnchor(0, 0, worldSeed).x, 0))
    || (Math.abs(globalTileX - townAnchor(0, 0, worldSeed).x) <= 1 && between(globalTileY, 0, townAnchor(0, 0, worldSeed).y, 0))
  );
  const segments = [
    between(globalTileX, center.x, east.x, width) && Math.abs(globalTileY - center.y) <= width,
    between(globalTileY, center.y, east.y, width) && Math.abs(globalTileX - east.x) <= width,
    between(globalTileY, center.y, south.y, width) && Math.abs(globalTileX - center.x) <= width,
    between(globalTileX, center.x, south.x, width) && Math.abs(globalTileY - south.y) <= width,
    between(globalTileX, west.x, center.x, width) && Math.abs(globalTileY - west.y) <= width,
    between(globalTileY, west.y, center.y, width) && Math.abs(globalTileX - center.x) <= width,
    between(globalTileY, north.y, center.y, width) && Math.abs(globalTileX - north.x) <= width,
    between(globalTileX, north.x, center.x, width) && Math.abs(globalTileY - center.y) <= width
  ];
  return townCross || spireLink || segments.some(Boolean);
}

export function nearestTown(globalTileX, globalTileY, worldSeed = WORLD_CONFIG.seed) {
  const macroX = Math.floor(globalTileX / MACRO_TILES);
  const macroY = Math.floor(globalTileY / MACRO_TILES);
  let best = null;
  for (let y = macroY - 1; y <= macroY + 1; y += 1) {
    for (let x = macroX - 1; x <= macroX + 1; x += 1) {
      const anchor = townAnchor(x, y, worldSeed);
      const distance = Math.hypot(anchor.x - globalTileX, anchor.y - globalTileY);
      if (!best || distance < best.distance) best = { ...anchor, macroX: x, macroY: y, distance };
    }
  }
  return best;
}
