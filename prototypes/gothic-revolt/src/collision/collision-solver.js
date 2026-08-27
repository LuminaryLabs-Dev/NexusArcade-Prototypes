import { circleIntersectsRect, segmentIntersectsRect } from './collision-shapes.js';

function resolveCircleRect(position, radius, rect) {
  if (!circleIntersectsRect(position.x, position.y, radius, rect)) return position;
  const closestX = Math.max(rect.x, Math.min(position.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(position.y, rect.y + rect.height));
  let dx = position.x - closestX;
  let dy = position.y - closestY;
  let distance = Math.hypot(dx, dy);
  if (distance === 0) {
    const choices = [
      { distance: Math.abs(position.x - rect.x), x: rect.x - radius, y: position.y },
      { distance: Math.abs(rect.x + rect.width - position.x), x: rect.x + rect.width + radius, y: position.y },
      { distance: Math.abs(position.y - rect.y), x: position.x, y: rect.y - radius },
      { distance: Math.abs(rect.y + rect.height - position.y), x: position.x, y: rect.y + rect.height + radius }
    ].sort((a, b) => a.distance - b.distance);
    return { x: choices[0].x, y: choices[0].y };
  }
  dx /= distance;
  dy /= distance;
  const overlap = radius - distance;
  return { x: position.x + dx * overlap, y: position.y + dy * overlap };
}

export function moveCircle(entity, dx, dy, radius, spatialHash) {
  let position = { x: entity.x + dx, y: entity.y };
  for (const rect of spatialHash.queryCircle(position.x, position.y, radius + Math.abs(dx))) position = resolveCircleRect(position, radius, rect);
  position.y += dy;
  for (const rect of spatialHash.queryCircle(position.x, position.y, radius + Math.abs(dy))) position = resolveCircleRect(position, radius, rect);
  entity.x = Math.round(position.x * 256) / 256;
  entity.y = Math.round(position.y * 256) / 256;
  return entity;
}

export function projectileBlocked(fromX, fromY, toX, toY, spatialHash) {
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;
  const radius = Math.hypot(toX - fromX, toY - fromY) / 2 + 4;
  return spatialHash.queryCircle(midX, midY, radius).some((rect) => segmentIntersectsRect(fromX, fromY, toX, toY, rect));
}
