const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Protect all dashboard routes - admin only
router.use(authenticate, authorize('admin'));

// Dashboard endpoints
router.get('/stats', dashboardController.getStats);
router.get('/recent-orders', dashboardController.getRecentOrders);
router.get('/recent-bookings', dashboardController.getRecentBookings);
router.get('/order-status', dashboardController.getOrderStatusDistribution);
router.get('/booking-status', dashboardController.getBookingStatusDistribution);
router.get('/activity', dashboardController.getActivityData);
router.get('/summary', dashboardController.getSummary);

module.exports = router;
