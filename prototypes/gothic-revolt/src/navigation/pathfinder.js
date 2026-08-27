const NEIGHBORS = Object.freeze([[0, -1], [-1, 0], [1, 0], [0, 1]]);

function key(x, y) {
  return `${x},${y}`;
}

export function findPath(start, goal, blocked, maxNodes = 2048) {
  const startKey = key(start.x, start.y);
  const goalKey = key(goal.x, goal.y);
  const open = [{ x: start.x, y: start.y, g: 0, f: Math.abs(goal.x - start.x) + Math.abs(goal.y - start.y), key: startKey }];
  const costs = new Map([[startKey, 0]]);
  const previous = new Map();
  let visited = 0;

  while (open.length && visited < maxNodes) {
    open.sort((a, b) => a.f - b.f || a.g - b.g || a.key.localeCompare(b.key));
    const current = open.shift();
    visited += 1;
    if (current.key === goalKey) {
      const path = [{ x: goal.x, y: goal.y }];
      let cursor = goalKey;
      while (previous.has(cursor)) {
        const point = previous.get(cursor);
        path.push({ x: point.x, y: point.y });
        cursor = point.key;
      }
      return path.reverse();
    }
    for (const [dx, dy] of NEIGHBORS) {
      const x = current.x + dx;
      const y = current.y + dy;
      const nextKey = key(x, y);
      if (blocked(x, y) && nextKey !== goalKey) continue;
      const nextCost = current.g + 1;
      if (nextCost >= (costs.get(nextKey) ?? Infinity)) continue;
      costs.set(nextKey, nextCost);
      previous.set(nextKey, { x: current.x, y: current.y, key: current.key });
      open.push({ x, y, g: nextCost, f: nextCost + Math.abs(goal.x - x) + Math.abs(goal.y - y), key: nextKey });
    }
  }
  return [];
}
