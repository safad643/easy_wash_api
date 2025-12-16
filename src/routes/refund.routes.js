const express = require('express');
const router = express.Router();
const refundController = require('../controllers/refund.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// All routes require admin auth
router.use(authenticate, authorize('admin'));

// Get refund stats
router.get('/stats', refundController.getRefundStats);

// List refunds with filters
router.get('/', refundController.getRefunds);

// Mark refund as processed
router.post('/:id/process', refundController.markRefunded);

module.exports = router;
