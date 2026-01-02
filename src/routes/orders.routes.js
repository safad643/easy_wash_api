const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/orders.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// All order endpoints require auth
router.post('/', authenticate, ordersController.create);
router.get('/', authenticate, ordersController.list);
router.get('/:id', authenticate, ordersController.detail);
router.get('/:id/invoice', authenticate, ordersController.invoice);
router.post('/:id/cancel', authenticate, ordersController.cancel);

module.exports = router;


