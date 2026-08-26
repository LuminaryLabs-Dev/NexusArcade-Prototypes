export function hash32(text) {
  let h = 2166136261;
  for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function surface(width = 64, height = 80) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

export function polygon(ctx, points, fill, edge = null) {
  const draw = (pts, color) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill();
  };
  if (edge) {
    const cx = points.reduce((n, p) => n + p[0], 0) / points.length;
    const cy = points.reduce((n, p) => n + p[1], 0) / points.length;
    draw(points.map(([x, y]) => [x + Math.sign(x - cx), y + Math.sign(y - cy)]), edge);
  }
  draw(points, fill);
}

export function line(ctx, a, b, width, fill, edge = '#101116') {
  ctx.lineCap = 'square';
  ctx.strokeStyle = edge; ctx.lineWidth = width + 2; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
  ctx.strokeStyle = fill; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
}

export function cluster(ctx, x, y, pattern, color) {
  ctx.fillStyle = color;
  for (const [dx, dy, w = 1, h = 1] of pattern) ctx.fillRect(x + dx, y + dy, w, h);
}
