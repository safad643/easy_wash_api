const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// All report endpoints require admin auth
router.use(authenticate, authorize('admin'));

// Orders reports
router.get('/orders', reportController.getOrdersReport);
router.get('/orders/summary', reportController.getOrdersSummary);
router.get('/orders/export/pdf', reportController.exportOrdersPdf);
router.get('/orders/export/csv', reportController.exportOrdersCsv);

// Bookings reports
router.get('/bookings', reportController.getBookingsReport);
router.get('/bookings/summary', reportController.getBookingsSummary);
router.get('/bookings/export/pdf', reportController.exportBookingsPdf);
router.get('/bookings/export/csv', reportController.exportBookingsCsv);

module.exports = router;
