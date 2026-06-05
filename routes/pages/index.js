const express = require('express');

module.exports = (upload) => {
  const router = express.Router();

  router.use(require('./index.routes'));
  router.use(require('./auth.pages'));
  router.use(require('./catalog.pages'));
  router.use(require('./cart.pages'));
  router.use(require('./profile.pages')(upload));
  router.use(require('./orders.pages'));
  router.use(require('./admin.pages'));

  return router;
};
