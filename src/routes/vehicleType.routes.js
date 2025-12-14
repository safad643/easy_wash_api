const express = require('express');
const vehicleTypeController = require('../controllers/vehicleType.controller');
const vehicleCategoryController = require('../controllers/vehicleCategory.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Public router
const publicRouter = express.Router();

// Public: Get active categories and types
publicRouter.get('/categories', vehicleCategoryController.getActiveCategories);
publicRouter.get('/', vehicleTypeController.getActiveVehicleTypes);

// Admin router
const adminRouter = express.Router();
adminRouter.use(authenticate);
adminRouter.use(authorize('admin'));

// Category routes
adminRouter.get('/categories', vehicleCategoryController.getCategories);
adminRouter.get('/categories/:id', vehicleCategoryController.getCategoryWithTypes);
adminRouter.post('/categories', vehicleCategoryController.createCategory);
adminRouter.put('/categories/:id', vehicleCategoryController.updateCategory);
adminRouter.delete('/categories/:id', vehicleCategoryController.deleteCategory);
adminRouter.get('/categories/:slug/count', vehicleCategoryController.countTypesInCategory);

// Type routes
adminRouter.get('/', vehicleTypeController.getVehicleTypes);
adminRouter.get('/:id', vehicleTypeController.getVehicleTypeById);
adminRouter.post('/', vehicleTypeController.createVehicleType);
adminRouter.put('/:id', vehicleTypeController.updateVehicleType);
adminRouter.delete('/:id', vehicleTypeController.deleteVehicleType);
adminRouter.get('/affected-services/:bodyType', vehicleTypeController.countAffectedServices);

module.exports = { publicRouter, adminRouter };
