export class EntityRegistry {
  constructor(start = 1) {
    this.nextId = start;
  }

  reset(start = 1) {
    this.nextId = start;
  }

  assign(entity) {
    entity.id = this.nextId;
    this.nextId += 1;
    return entity;
  }

  stable(values) {
    return values.slice().sort((left, right) => left.id - right.id);
  }
}
