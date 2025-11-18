const express = require('express');
const router = express.Router();
const staffJobController = require('../controllers/staffJob.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// All routes require staff authentication
router.use(authenticate, authorize('staff'));

// Staff job management routes
router.get('/', staffJobController.list);
router.get('/history', staffJobController.history);
router.get('/:id', staffJobController.detail);
router.patch('/:id', staffJobController.updateStatus); // General status update (matches frontend)
router.post('/:id/complete', staffJobController.complete); // Specific complete endpoint
router.post('/:id/couldnt-reach', staffJobController.markCouldntReach);

module.exports = router;

