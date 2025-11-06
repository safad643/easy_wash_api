const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Public: preview pricing
router.post('/preview', authenticate, bookingController.preview);

// Public: available slots (no auth needed to browse)
router.get('/slots', bookingController.slots);

// Auth required for booking operations
router.post('/', authenticate, bookingController.create);
router.get('/', authenticate, bookingController.list);
router.get('/:id', authenticate, bookingController.detail);
router.post('/:id/cancel', authenticate, bookingController.cancel);

module.exports = router;


