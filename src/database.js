const fs = require('fs');
const path = require('path');
const promisify = require('util').promisify;

class Database {
  constructor(path) {
    this._path = path;
  }
  _encode(id) {
    if (!(/^[a-z0-9]+$/g).test(id)) {
      throw new Error('Invalid id');
    }
    return `${id}.json`;
  }
  _decode(filename) {
    if (!filename.endsWith('.json')) {
      throw new Error('Invalid filename');
    }
    return filename.substr(0, filename.length-5);
  }
  _filename(id) {
    return path.join(this._path, this._encode(id));
  }
  _stringify(obj) {
    return `${JSON.stringify(obj, null, '  ')}\n`;
  }
  _parse(str) {
    return JSON.parse(str);
  }
  async _mkdir() {
    try {
      await promisify(fs.mkdir)(this._path);
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
  }
  async create(id, obj) {
    await this._mkdir();
    const filename = this._filename(id);
    await promisify(fs.writeFile)(
      filename,
      this._stringify(obj),
      { flag: 'wx' },
    );
  }
  async read(id) {
    await this._mkdir();
    let data;
    try {
      data = await promisify(fs.readFile)(
        this._filename(id),
        { encoding: 'utf8' },
      );
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      return null;
    }
    return this._parse(data);
  }
  async write(id, obj) {
    await this._mkdir();
    const filename = this._filename(id)
    await promisify(fs.writeFile)(
      `${filename}~`,
      this._stringify(obj),
    );
    await promisify(fs.rename)(
      `${filename}~`,
      filename,
    );
  }
  async update(id, callback) {
    await this._mkdir();
    const filename = this._filename(id)
    const data = await promisify(fs.readFile)(
      filename,
      { encoding: 'utf8' },
    );
    const obj1 = this._parse(data);
    const obj2 = await callback(obj1);
    await promisify(fs.writeFile)(
      `${filename}~`,
      this._stringify(obj2),
    );
    await promisify(fs.rename)(
      `${filename}~`,
      filename,
    );
  }
  async delete(id) {
    await this._mkdir();
    await promisify(fs.unlink)(this._filename(id));
  }
  async list() {
    await this._mkdir();
    const filenames = await promisify(fs.readdir)(this._path);
    const ids = [];
    filenames.forEach((filename) => {
      try {
        ids.push(this._decode(filename));
      } catch (err) {
      }
    });
    return ids;
  }
}

module.exports = {
  Database,
};
