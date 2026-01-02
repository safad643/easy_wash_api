const express = require('express');
const settingsController = require('../controllers/settings.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Public router - no auth required
const publicRouter = express.Router();
publicRouter.get('/platform-contact', settingsController.getPlatformContact);
publicRouter.get('/company-details', settingsController.getCompanyDetails);
publicRouter.get('/delivery-settings', settingsController.getDeliverySettings);

// Admin router - requires auth + admin role
const adminRouter = express.Router();
adminRouter.use(authenticate);
adminRouter.use(authorize('admin'));

adminRouter.get('/platform-contact', settingsController.getPlatformContact);
adminRouter.put('/platform-contact', settingsController.updatePlatformContact);

adminRouter.get('/company-details', settingsController.getCompanyDetails);
adminRouter.put('/company-details', settingsController.updateCompanyDetails);

adminRouter.get('/delivery-settings', settingsController.getDeliverySettings);
adminRouter.put('/delivery-settings', settingsController.updateDeliverySettings);

module.exports = { publicRouter, adminRouter };
