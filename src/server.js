const express = require('express');
const helmet = require('helmet');

const api = require('./api');
const gui = require('./gui');
const database = require('./database');

(async () => {
  const app = express();

  const PORT = 8000;

  app.use(helmet({
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", 'wss:'],
    } },
  }));

  const db = new database.Database('../data2');

  app.use('/.well-known/cryptouser', api(db));
  app.use('/', gui('../static'));

  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
})().catch((err) => {
  console.error(err);
});
