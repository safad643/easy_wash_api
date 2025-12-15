const express = require('express');
const addonController = require('../controllers/addon.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Public router - for customer-facing endpoints
const publicRouter = express.Router();

// GET /api/addons - Get active add-ons (optionally filtered by category)
publicRouter.get('/', addonController.getActiveAddons);

// Admin router - requires authentication and admin role
const adminRouter = express.Router();
adminRouter.use(authenticate, authorize('admin'));

// GET /api/admin/addons - List all add-ons (with pagination)
adminRouter.get('/', addonController.getAddons);

// POST /api/admin/addons - Create new add-on
adminRouter.post('/', addonController.createAddon);

// GET /api/admin/addons/:id - Get add-on by ID
adminRouter.get('/:id', addonController.getAddonById);

// PUT /api/admin/addons/:id - Update add-on
adminRouter.put('/:id', addonController.updateAddon);

// DELETE /api/admin/addons/:id - Delete add-on
adminRouter.delete('/:id', addonController.deleteAddon);

module.exports = { publicRouter, adminRouter };
