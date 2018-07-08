class Limiter {
  constructor(count, minutes) {
    this._count = count;
    this._minutes = minutes;
    this._map = Object.create(null);
    setInterval(() => {
      Object.keys(this._map).forEach((key) => {
        this._map[key] += 1;
        if (this._map[key] >= this._count * this._minutes) {
          delete this._map[key];
        }
      });
    }, 60*1000);
  }
  check(key) {
    if (!(key in this._map)) {
      return true;
    }
    return this._map[key] >= this._minutes;
  }
  use(key) {
    if (!(key in this._map)) {
      this._map[key] = this._count * this._minutes;
    }
    this._map[key] -= this._minutes;
  }
}

module.exports = Limiter;
