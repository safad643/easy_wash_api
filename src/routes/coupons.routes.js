const express = require('express');
const router = express.Router();
const couponsController = require('../controllers/coupons.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.post('/apply', authenticate, couponsController.apply);

module.exports = router;


