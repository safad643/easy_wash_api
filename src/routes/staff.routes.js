const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staff.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// All routes require admin authentication
router.use(authenticate, authorize('admin'));

// Staff management routes
router.get('/', staffController.list);
router.post('/', staffController.create);
router.get('/leaves', staffController.getLeavesByDate); // Must be before /:id to avoid conflict
router.get('/:id', staffController.getById);
router.patch('/:id', staffController.update);
router.delete('/:id', staffController.delete);
router.patch('/:id/status', staffController.updateStatus);

// Staff leave routes
router.post('/:id/leave', staffController.markLeave);
router.delete('/:id/leave', staffController.removeLeave);

// Staff collections and handover routes
router.get('/:id/collections', staffController.getCollections);
router.post('/:id/handover', staffController.markHandover);

module.exports = router;

