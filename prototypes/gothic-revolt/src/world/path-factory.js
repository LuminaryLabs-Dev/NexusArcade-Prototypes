export function buildingEntrance(building) {
  const centerX = building.x + building.width / 2;
  const centerY = building.y + building.height / 2;
  if (building.facing === 'south') return { x: centerX, y: building.y + building.height, axis: 'vertical' };
  if (building.facing === 'north') return { x: centerX, y: building.y - 1, axis: 'vertical' };
  if (building.facing === 'east') return { x: building.x + building.width, y: centerY, axis: 'horizontal' };
  return { x: building.x - 1, y: centerY, axis: 'horizontal' };
}

export function entrancePathAt(globalTileX, globalTileY, buildings, width = 1) {
  return buildings.some((building) => {
    if (building.theme !== 'rotwood') return false;
    const entrance = buildingEntrance(building);
    const town = building.town;
    if (!town) return false;
    if (entrance.axis === 'vertical') {
      return Math.abs(globalTileX - entrance.x) <= width
        && globalTileY >= Math.min(entrance.y, town.y) - width
        && globalTileY <= Math.max(entrance.y, town.y) + width;
    }
    return Math.abs(globalTileY - entrance.y) <= width
      && globalTileX >= Math.min(entrance.x, town.x) - width
      && globalTileX <= Math.max(entrance.x, town.x) + width;
  });
}

export function buildEntrancePathSet(buildings, minTileX, minTileY, maxTileX, maxTileY, width = 1) {
  const cells = new Set();
  const add = (x, y) => {
    if (x >= minTileX && x <= maxTileX && y >= minTileY && y <= maxTileY) cells.add(`${x},${y}`);
  };
  for (const building of buildings) {
    if (building.theme !== 'rotwood' || !building.town) continue;
    const entrance = buildingEntrance(building);
    if (entrance.axis === 'vertical') {
      const startY = Math.floor(Math.min(entrance.y, building.town.y) - width);
      const endY = Math.ceil(Math.max(entrance.y, building.town.y) + width);
      const startX = Math.floor(entrance.x - width);
      const endX = Math.ceil(entrance.x + width);
      for (let y = startY; y <= endY; y += 1) for (let x = startX; x <= endX; x += 1) add(x, y);
    } else {
      const startX = Math.floor(Math.min(entrance.x, building.town.x) - width);
      const endX = Math.ceil(Math.max(entrance.x, building.town.x) + width);
      const startY = Math.floor(entrance.y - width);
      const endY = Math.ceil(entrance.y + width);
      for (let x = startX; x <= endX; x += 1) for (let y = startY; y <= endY; y += 1) add(x, y);
    }
  }
  return cells;
}

export function connectivityMask(globalTileX, globalTileY, contains) {
  let mask = 0;
  if (contains(globalTileX, globalTileY - 1)) mask |= 1;
  if (contains(globalTileX + 1, globalTileY)) mask |= 2;
  if (contains(globalTileX, globalTileY + 1)) mask |= 4;
  if (contains(globalTileX - 1, globalTileY)) mask |= 8;
  return mask;
}
