const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/orders.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

router.use(authenticate, authorize('admin'));

router.get('/', ordersController.adminList);
router.get('/:id', ordersController.adminDetail);
router.patch('/:id/status', ordersController.adminUpdateStatus);
router.get('/:id/invoice', ordersController.adminInvoice);

module.exports = router;

