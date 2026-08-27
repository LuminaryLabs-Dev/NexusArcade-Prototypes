import { WORLD_CONFIG } from '../world/world-config.js';

function bezier(a, b, c, d, t) {
  const m = 1 - t;
  return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d;
}

export function drawTether(ctx, player, timerSeconds, animation, cameraX, cameraY) {
  const playerScreen = { x: player.x - cameraX, y: player.y - cameraY - 28 };
  const spireScreen = { x: WORLD_CONFIG.spire.x - cameraX, y: WORLD_CONFIG.spire.y - cameraY - 78 };
  const margin = 24;
  const visible = spireScreen.x >= margin && spireScreen.y >= margin && spireScreen.x <= ctx.canvas.width - margin && spireScreen.y <= ctx.canvas.height - margin;
  let target = spireScreen;
  if (!visible) {
    const dx = spireScreen.x - playerScreen.x;
    const dy = spireScreen.y - playerScreen.y;
    const scale = Math.min(
      dx > 0 ? (ctx.canvas.width - margin - playerScreen.x) / dx : (margin - playerScreen.x) / dx,
      dy > 0 ? (ctx.canvas.height - margin - playerScreen.y) / dy : (margin - playerScreen.y) / dy
    );
    target = { x: playerScreen.x + dx * Math.max(0, scale), y: playerScreen.y + dy * Math.max(0, scale) };
  }
  const urgency = 1 - Math.max(0, Math.min(300, timerSeconds)) / 300;
  const dx = target.x - playerScreen.x;
  const dy = target.y - playerScreen.y;
  const normalX = -dy * 0.16;
  const normalY = dx * 0.16;
  const controlA = { x: playerScreen.x + dx * 0.33 + normalX, y: playerScreen.y + dy * 0.33 + normalY };
  const controlB = { x: playerScreen.x + dx * 0.67 - normalX, y: playerScreen.y + dy * 0.67 - normalY };
  ctx.save();
  ctx.strokeStyle = timerSeconds < 10 ? 'rgba(244,76,96,.68)' : `rgba(177,126,190,${0.18 + urgency * 0.28})`;
  ctx.lineWidth = timerSeconds < 60 ? 2 : 1;
  ctx.setLineDash([3, 8]);
  ctx.lineDashOffset = -animation * (14 + urgency * 42);
  ctx.beginPath();
  ctx.moveTo(playerScreen.x, playerScreen.y);
  ctx.bezierCurveTo(controlA.x, controlA.y, controlB.x, controlB.y, target.x, target.y);
  ctx.stroke();
  ctx.setLineDash([]);
  const particles = 8 + Math.floor(urgency * 8);
  for (let index = 0; index < particles; index += 1) {
    const t = (animation * (0.09 + urgency * 0.24) + index / particles) % 1;
    const x = bezier(playerScreen.x, controlA.x, controlB.x, target.x, t);
    const y = bezier(playerScreen.y, controlA.y, controlB.y, target.y, t);
    ctx.fillStyle = timerSeconds < 10 ? '#ef5867' : index % 3 ? '#a879b9' : '#eadb9e';
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, urgency > 0.8 ? 4 : 3, urgency > 0.8 ? 4 : 3);
  }
  if (!visible) {
    ctx.strokeStyle = '#d7c17a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 8 + Math.sin(animation * 4) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
