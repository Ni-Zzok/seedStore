const express = require('express');
module.exports = (upload) => {
  const router = express.Router();
  router.use('/auth', require('./auth.routes'));
  router.use('/products', require('./products.routes'));
  router.use('/categories', require('./categories.routes'));
  router.use('/suppliers', require('./suppliers.routes'));
  router.use('/supplies', require('./supplies.routes'));
  router.use('/cart', require('./cart.routes'));
  router.use('/orders', require('./orders.routes'));
  router.use('/profile', require('./profile.routes')(upload));
  return router;
};
