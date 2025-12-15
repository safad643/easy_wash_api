const express = require('express');
const complaintController = require('../controllers/complaint.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Customer routes
const customerRouter = express.Router();
customerRouter.post('/', authenticate, complaintController.create);
customerRouter.get('/can-file/:referenceType/:referenceId', authenticate, complaintController.canFileComplaint);
customerRouter.get('/:referenceType/:referenceId', authenticate, complaintController.getByReference);

// Admin routes
const adminRouter = express.Router();
adminRouter.get('/', authenticate, authorize('admin'), complaintController.adminList);
adminRouter.get('/:id', authenticate, authorize('admin'), complaintController.adminDetail);
adminRouter.patch('/:id/resolve', authenticate, authorize('admin'), complaintController.adminResolve);

module.exports = {
    customerRouter,
    adminRouter,
};
