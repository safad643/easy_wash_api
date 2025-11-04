const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicle.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.get('/', authenticate, vehicleController.getVehicles);
router.post('/', authenticate, vehicleController.createVehicle);
router.patch('/:id', authenticate, vehicleController.updateVehicle);
router.delete('/:id', authenticate, vehicleController.deleteVehicle);

module.exports = router;


