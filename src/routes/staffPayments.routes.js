const express = require('express');
const router = express.Router();
const staffPaymentsController = require('../controllers/staffPayments.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// All routes require staff authentication
router.use(authenticate);
router.use(authorize('staff'));

// GET /staff/payments - Get collections for a specific date
router.get('/', staffPaymentsController.getCollections);

// GET /staff/payments/summary - Get collection summary for past days
router.get('/summary', staffPaymentsController.getSummary);

module.exports = router;
