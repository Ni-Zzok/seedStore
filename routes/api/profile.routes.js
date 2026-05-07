const express = require('express');
const { asyncHandler } = require('../../middleware/errorHandler');
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/profile.controller');
module.exports = (upload) => {
  const router = express.Router();
  router.use(requireAuth);
  router.get('/', asyncHandler(c.getProfile));
  router.patch('/', asyncHandler(c.updateProfile));
  router.post('/avatar', upload.single('avatar'), asyncHandler(c.uploadAvatar));
  return router;
};
