export function separation(entity, neighbors, radius = 38) {
  let x = 0;
  let y = 0;
  for (const other of neighbors) {
    if (other === entity || other.hp <= 0) continue;
    const dx = entity.x - other.x;
    const dy = entity.y - other.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0 && distance < radius) {
      const weight = (radius - distance) / radius;
      x += dx / distance * weight;
      y += dy / distance * weight;
    }
  }
  const length = Math.hypot(x, y);
  return length ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}
