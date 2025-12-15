const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// All routes require admin authentication
router.use(authenticate, authorize('admin'));

// Customer management routes
router.get('/', customerController.list);
router.get('/:id', customerController.getById);
router.patch('/:id/status', customerController.updateStatus);

module.exports = router;
