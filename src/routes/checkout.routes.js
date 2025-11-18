const express = require('express');
const router = express.Router();
const checkoutController = require('../controllers/checkout.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.post('/session', authenticate, checkoutController.createSession);
router.post('/success', authenticate, checkoutController.paymentSuccess);
router.post('/failure', authenticate, checkoutController.paymentFailure);
router.post('/verify', authenticate, checkoutController.verifyPayment);

module.exports = router;


