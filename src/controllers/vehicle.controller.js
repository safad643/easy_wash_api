const vehicleService = require('../services/vehicle.service');

const getVehicles = async (req, res, next) => {
  const vehicles = await vehicleService.listUserVehicles(req.userId);
  res.json({ success: true, data: vehicles });
};

const createVehicle = async (req, res, next) => {
  const vehicle = await vehicleService.createVehicle(req.userId, req.body);
  res.status(201).json({ success: true, data: vehicle });
};

const updateVehicle = async (req, res, next) => {
  const updated = await vehicleService.updateVehicle(req.userId, req.params.id, req.body);
  res.json({ success: true, data: updated });
};

const deleteVehicle = async (req, res, next) => {
  const result = await vehicleService.deleteVehicle(req.userId, req.params.id);
  res.json({ success: true, data: result });
};

module.exports = {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
};


