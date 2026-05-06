const express = require('express');
const { asyncHandler } = require('../../middleware/errorHandler');
const c = require('../../controllers/auth.controller');
const router = express.Router();
router.post('/register', asyncHandler(c.register));
router.post('/login', asyncHandler(c.login));
router.post('/logout', asyncHandler(c.logout));
router.get('/me', asyncHandler(c.me));
module.exports = router;
