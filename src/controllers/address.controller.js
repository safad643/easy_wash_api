const addressService = require('../services/address.service');

const getAddresses = async (req, res, next) => {
  const addresses = await addressService.listUserAddresses(req.userId);
  res.json({ success: true, data: addresses });
};

const createAddress = async (req, res, next) => {
  const address = await addressService.createAddress(req.userId, req.body);
  res.status(201).json({ success: true, data: address });
};

const updateAddress = async (req, res, next) => {
  const updated = await addressService.updateAddress(req.userId, req.params.id, req.body);
  res.json({ success: true, data: updated });
};

const deleteAddress = async (req, res, next) => {
  const result = await addressService.deleteAddress(req.userId, req.params.id);
  res.json({ success: true, data: result });
};

const setPrimaryAddress = async (req, res, next) => {
  const updated = await addressService.setPrimaryAddress(req.userId, req.params.id);
  res.json({ success: true, data: updated });
};

module.exports = {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setPrimaryAddress,
};


