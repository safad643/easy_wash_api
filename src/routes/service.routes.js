const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/service.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Public routes
router.get('/', serviceController.getServices);
router.get('/:id', serviceController.getServiceById);

// Admin-only routes
router.post('/', authenticate, authorize('admin'), serviceController.createService);
router.put('/:id', authenticate, authorize('admin'), serviceController.updateService);
router.delete('/:id', authenticate, authorize('admin'), serviceController.deleteService);

module.exports = router;



