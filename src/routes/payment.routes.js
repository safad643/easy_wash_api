const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/payment.controller');

// GET /api/admin/payments - List all payments
router.get('/', PaymentController.getPayments);

// GET /api/admin/payments/summary - Payment summary stats
router.get('/summary', PaymentController.getSummary);

// GET /api/admin/payments/analytics - Payment analytics for charts
router.get('/analytics', PaymentController.getAnalytics);

module.exports = router;
