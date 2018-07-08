const express = require('express');
const http = require('http');
const sodium = require('libsodium-wrappers');
const ipaddr = require('ipaddr.js');

const Limiter = require('./limiter');

function hashStr(data) {
  return sodium.to_base64(sodium.crypto_generichash(32, data));
}

function hashCmp(data, hash) {
  if (!data) {
    return false;
  }
  const dataHash = sodium.crypto_generichash(32, data);
  return sodium.memcmp(dataHash, sodium.from_base64(hash))
}

function error(res, code) {
  res.status(code).json({
    error: `${code} ${http.STATUS_CODES[code]}`,
  });
}

function getKey(req) {
  const addr = ipaddr.process(req.connection.remoteAddress);
  if (addr.kind() == 'ipv4') {
    return addr.toByteArray().join('.');
  }
  return addr.toByteArray().slice(0, 6).join('.');
}

module.exports = (db) => {
  const app = express.Router();

  app.use(express.json());

  const createUserIpLimiter = new Limiter(50, 1);
  const getPublicIpLimiter = new Limiter(50, 1);
  const ipLimiter = new Limiter(50, 1);
  const userLimiter = new Limiter(5, 10);

  app.post('/get_version', async (req, res, next) => {
    res.json({
      version: '0.1',
    });
  });

  app.post('/create_user', async (req, res, next) => {
    try {
      const id = req.body.id;
      if (typeof id !== 'string') {
        return next(400);
      }
      const accessKey = req.body.accessKey;
      if (typeof accessKey !== 'string') {
        return next(400);
      }
      const publicData = req.body.publicData;
      if (publicData === undefined) {
        return next(400);
      }
      const protectedData = req.body.protectedData;
      if (protectedData === undefined) {
        return next(400);
      }
      const key = getKey(req);
      if (!createUserIpLimiter.check(key)) {
        return next(429);
      }
      createUserIpLimiter.use(key);
      const obj = {
        accessKeyHash: hashStr(accessKey),
        publicData: publicData,
        protectedData: protectedData,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      };
      const obj2 = await db.read(id);
      if (obj2 !== null) {
        return next(409);
      }
      await db.create(id, obj);
      return res.json({
        publicData: obj.publicData,
        protectedData: obj.protectedData,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/get_public', async (req, res, next) => {
    try {
      const id = req.body.id;
      if (typeof id !== 'string') {
        return next(400);
      }
      const key = getKey(req);
      if (!getPublicIpLimiter.check(key)) {
        return next(429);
      }
      getPublicIpLimiter.use(key);
      const obj = await db.read(id);
      if (!obj) {
        return next(404);
      }
      res.json({
        publicData: obj.publicData,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/get_protected', async (req, res, next) => {
    try {
      const id = req.body.id;
      if (typeof id !== 'string') {
        return next(400);
      }
      const authAccessKey = req.header('Authorization');
      if (typeof authAccessKey !== 'string') {
        return next(400);
      }
      const obj = await db.read(id);
      if (!obj) {
        return next(404);
      }
      const key = getKey(req);
      if (!ipLimiter.check(key) || !userLimiter.check(id)) {
        return next(429);
      }
      if (!hashCmp(authAccessKey, obj.accessKeyHash)) {
        ipLimiter.use(key);
        userLimiter.use(id);
        return next(401);
      }
      res.json({
        protectedData: obj.protectedData,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/update_user', async (req, res, next) => {
    try {
      const id = req.body.id;
      if (typeof id !== 'string') {
        return next(400);
      }
      const publicData = req.body.publicData;
      if (publicData === undefined) {
        return next(400);
      }
      const protectedData = req.body.protectedData;
      if (protectedData === undefined) {
        return next(400);
      }
      const accessKey = req.body.accessKey;
      if (typeof accessKey !== 'string') {
        return next(400);
      }
      const authAccessKey = req.header('Authorization');
      if (typeof authAccessKey !== 'string') {
        return next(400);
      }
      let obj = await db.read(id);
      const key = getKey(req);
      if (!ipLimiter.check(key) || !userLimiter.check(id)) {
        return next(429);
      }
      if (!hashCmp(authAccessKey, obj.accessKeyHash)) {
        ipLimiter.use(key);
        userLimiter.use(id);
        return next(401);
      }
      obj.accessKeyHash = hashStr(accessKey);
      obj.publicData = publicData;
      obj.protectedData = protectedData;
      obj.modified = new Date().toISOString();
      await db.write(id, obj);
      res.send({
        publicData: publicData,
        protectedData: protectedData,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/delete_user', async (req, res, next) => {
    try {
      const id = req.body.id;
      if (typeof id !== 'string') {
        return next(400);
      }
      const obj = await db.read(id);
      if (!obj) {
        return next(404);
      }
      const key = getKey(req);
      if (!ipLimiter.check(key) || !userLimiter.check(id)) {
        return next(429);
      }
      const authAccessKey = req.header('Authorization');
      if (typeof authAccessKey !== 'string') {
        return next(400);
      }
      if (!hashCmp(authAccessKey, obj.accessKeyHash)) {
        ipLimiter.use(key);
        userLimiter.use(id);
        return next(401);
      }
      await db.delete(id);
      res.send({});
    } catch (err) {
      next(err);
    }
  });

  app.post('/get_users', async (req, res, next) => {
    try {
      const ids = await db.list();
      res.send(ids);
    } catch (err) {
      next(err);
    }
  });

  app.use((req, res, next) => {
    next(404);
  });

  app.use((err, req, res, next) => {
    if (typeof err === 'number') {
      return error(res, err);
    }
    console.error(err);
    if (res.headersSent) {
      return next(err);
    }
    error(res, 500);
  });

  return app;
};
