import { WORLD_CONFIG } from '../world/world-config.js';

export function drawSpire(ctx, cameraX, cameraY, animation, atlas) {
  const x = WORLD_CONFIG.spire.x - cameraX;
  const y = WORLD_CONFIG.spire.y - cameraY;
  if (x < -140 || y < -180 || x > ctx.canvas.width + 140 || y > ctx.canvas.height + 140) return;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.fillStyle = '#0b090d';
  ctx.fillRect(-42, -80, 84, 94);
  ctx.fillStyle = '#3a253f';
  ctx.fillRect(-28, -108, 56, 118);
  ctx.fillStyle = '#72537d';
  ctx.fillRect(-17, -128, 34, 132);
  ctx.fillStyle = '#d6c171';
  ctx.fillRect(-5, -145, 10, 138);
  const pulse = 0.55 + Math.sin(animation * 4) * 0.22;
  ctx.globalAlpha = pulse;
  atlas.draw(ctx, 'effects', Math.floor(animation * 8) % 32, -32, -42, 64, 64);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#a57bbb';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 6, 55 + Math.sin(animation * 2) * 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
