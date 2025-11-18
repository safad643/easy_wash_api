const express = require('express');
const router = express.Router();
const adminRequestsController = require('../controllers/adminRequests.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// All routes require admin auth
router.use(authenticate, authorize('admin'));

// Slots management - MUST come before /:id route to avoid route conflicts
router.get('/slots', adminRequestsController.getSlots);
router.post('/slots', adminRequestsController.createSlots);
router.patch('/slots/:slotId', adminRequestsController.updateSlot);
router.post('/slots/bulk-status', adminRequestsController.updateSlotsStatus);

// Booking management endpoints
router.get('/', adminRequestsController.getAllBookings);
router.get('/:id', adminRequestsController.getBookingDetail);
router.post('/:id/assign', adminRequestsController.assignStaff);
router.delete('/:id/assign', adminRequestsController.removeStaffAssignment);
router.patch('/:id/status', adminRequestsController.updateBookingStatus);

module.exports = router;


