export function circleIntersectsRect(x, y, radius, rect) {
  const closestX = Math.max(rect.x, Math.min(x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(y, rect.y + rect.height));
  const dx = x - closestX;
  const dy = y - closestY;
  return dx * dx + dy * dy < radius * radius;
}

export function segmentIntersectsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let near = 0;
  let far = 1;
  const tests = [
    [-dx, x1 - rect.x],
    [dx, rect.x + rect.width - x1],
    [-dy, y1 - rect.y],
    [dy, rect.y + rect.height - y1]
  ];
  for (const [p, q] of tests) {
    if (p === 0 && q < 0) return false;
    if (p !== 0) {
      const ratio = q / p;
      if (p < 0) near = Math.max(near, ratio);
      else far = Math.min(far, ratio);
      if (near > far) return false;
    }
  }
  return true;
}
