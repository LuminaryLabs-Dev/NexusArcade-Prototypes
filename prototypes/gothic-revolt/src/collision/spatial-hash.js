export class SpatialHash {
  constructor(cellSize = 64) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  clear() {
    this.cells.clear();
  }

  key(x, y) {
    return `${x},${y}`;
  }

  insert(shape) {
    const minX = Math.floor(shape.x / this.cellSize);
    const minY = Math.floor(shape.y / this.cellSize);
    const maxX = Math.floor((shape.x + shape.width) / this.cellSize);
    const maxY = Math.floor((shape.y + shape.height) / this.cellSize);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const key = this.key(x, y);
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(shape);
      }
    }
  }

  rebuild(shapes) {
    this.clear();
    for (const shape of shapes.slice().sort((a, b) => a.id.localeCompare(b.id))) this.insert(shape);
    return this;
  }

  queryCircle(x, y, radius) {
    const found = new Map();
    const minX = Math.floor((x - radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);
    for (let cellY = minY; cellY <= maxY; cellY += 1) {
      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        for (const shape of this.cells.get(this.key(cellX, cellY)) || []) found.set(shape.id, shape);
      }
    }
    return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}
