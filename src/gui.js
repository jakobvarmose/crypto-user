const express = require('express');
const path = require('path');

module.exports = (dir) => {
  const app = express.Router();

  app.use(express.static(path.join(__dirname, dir)));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, dir, 'index.html'));
  });

  return app;
};
