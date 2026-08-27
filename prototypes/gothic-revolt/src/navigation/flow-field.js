const DIRECTIONS = Object.freeze([[0, -1], [-1, 0], [1, 0], [0, 1]]);

export class FlowField {
  constructor(radius = 18, cellSize = 32) {
    this.radius = radius;
    this.cellSize = cellSize;
    this.costs = new Map();
    this.target = { x: 0, y: 0 };
  }

  key(x, y) {
    return `${x},${y}`;
  }

  rebuild(targetPixelX, targetPixelY, blocked) {
    const targetX = Math.floor(targetPixelX / this.cellSize);
    const targetY = Math.floor(targetPixelY / this.cellSize);
    this.target = { x: targetX, y: targetY };
    this.costs.clear();
    const queue = [{ x: targetX, y: targetY }];
    this.costs.set(this.key(targetX, targetY), 0);
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      const cost = this.costs.get(this.key(current.x, current.y));
      for (const [dx, dy] of DIRECTIONS) {
        const x = current.x + dx;
        const y = current.y + dy;
        if (Math.abs(x - targetX) > this.radius || Math.abs(y - targetY) > this.radius || blocked(x, y)) continue;
        const key = this.key(x, y);
        if (this.costs.has(key)) continue;
        this.costs.set(key, cost + 1);
        queue.push({ x, y });
      }
    }
  }

  directionAt(pixelX, pixelY) {
    const cellX = Math.floor(pixelX / this.cellSize);
    const cellY = Math.floor(pixelY / this.cellSize);
    let best = this.costs.get(this.key(cellX, cellY)) ?? Infinity;
    let direction = null;
    for (const [dx, dy] of DIRECTIONS) {
      const cost = this.costs.get(this.key(cellX + dx, cellY + dy)) ?? Infinity;
      if (cost < best) {
        best = cost;
        direction = { x: dx, y: dy };
      }
    }
    return direction;
  }
}
