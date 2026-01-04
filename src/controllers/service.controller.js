const serviceService = require('../services/service.service');

const createService = async (req, res, next) => {
  const serviceData = req.body;
  const service = await serviceService.createService(serviceData);
  res.status(201).json({ success: true, data: service });
};

const getServices = async (req, res, next) => {
  const filters = {
    category: req.query.category,
    search: req.query.search,
    status: req.query.status,
    page: req.query.page || 1,
    limit: req.query.limit || 10,
    sortBy: req.query.sortBy || 'name',
    sortOrder: req.query.sortOrder || 'asc',
  };

  Object.keys(filters).forEach((k) => filters[k] === undefined && delete filters[k]);

  const result = await serviceService.getServices(filters);
  res.json({ success: true, data: result });
};

const getServiceById = async (req, res, next) => {
  const { id } = req.params;
  const service = await serviceService.getServiceById(id);
  res.json({ success: true, data: service });
};

const updateService = async (req, res, next) => {
  const { id } = req.params;
  const updateData = req.body;
  delete updateData._id;
  delete updateData.createdAt;
  // Category cannot be edited - remove it from updateData
  delete updateData.category;
  // VehicleType is not a top-level field (it's in pricing array) - remove if sent
  delete updateData.vehicleType;
  const service = await serviceService.updateService(id, updateData);
  res.json({ success: true, data: service });
};

const getServiceReviews = async (req, res, next) => {
  const { id } = req.params;
  const { page, limit } = req.query;
  const result = await serviceService.getServiceReviews(id, { page, limit });
  res.json({ success: true, data: result });
};

const deleteService = async (req, res, next) => {
  const { id } = req.params;
  await serviceService.deleteService(id);
  res.json({ success: true, message: 'Service deleted successfully' });
};

const getTopReviews = async (req, res, next) => {
  const limit = parseInt(req.query.limit) || 3;
  const reviews = await serviceService.getTopReviews(limit);
  res.json({ success: true, data: reviews });
};

const getLandingPageStats = async (req, res, next) => {
  const stats = await serviceService.getLandingPageStats();
  res.json({ success: true, data: stats });
};

module.exports = {
  createService,
  getServices,
  getServiceById,
  getServiceReviews,
  getTopReviews,
  getLandingPageStats,
  updateService,
  deleteService,
};



