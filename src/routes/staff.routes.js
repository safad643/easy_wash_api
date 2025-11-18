const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staff.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// All routes require admin authentication
router.use(authenticate, authorize('admin'));

// Staff management routes
router.get('/', staffController.list);
router.post('/', staffController.create);
router.get('/:id', staffController.getById);
router.patch('/:id', staffController.update);
router.delete('/:id', staffController.delete);
router.patch('/:id/status', staffController.updateStatus);

module.exports = router;

