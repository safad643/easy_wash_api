const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/orders.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// All order endpoints require auth
router.get('/', authenticate, ordersController.list);
router.get('/:id', authenticate, ordersController.detail);
router.get('/:id/invoice', authenticate, ordersController.invoice);
router.post('/:id/cancel', authenticate, ordersController.cancel);
router.post('/:id/feedback', authenticate, ordersController.feedback);

module.exports = router;


