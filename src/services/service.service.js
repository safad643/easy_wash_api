const Service = require('../models/service.model');
const { NotFoundError, BadRequestError } = require('../utils/errors');

class ServiceService {
  async createService(serviceData) {
    // Validate category is either 'bike' or 'car'
    if (serviceData.category && !['bike', 'car'].includes(serviceData.category)) {
      throw new BadRequestError('Category must be either "bike" or "car"');
    }

    const service = new Service(serviceData);
    await service.save();
    return service;
  }

  async getServices(filters = {}) {
    const {
      category,
      search,
      status, // 'active' | 'inactive'
      page = 1,
      limit = 10,
      sortBy = 'name',
      sortOrder = 'asc',
    } = filters;

    const query = {};

    // Filter by category (bike or car)
    if (category && ['bike', 'car'].includes(category)) {
      query.category = category;
    }

    if (status) query.isAvailable = status === 'active';

    if (search) {
      // Escape special regex characters to prevent regex injection
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Use regex for case-insensitive search on name and description
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const sort = {};
    const allowedSort = ['name', 'rating', 'duration'];
    const sortField = allowedSort.includes(sortBy) ? sortBy : 'name';
    sort[sortField] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const total = await Service.countDocuments(query);
    const services = await Service.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    return {
      data: services,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  async getServiceById(id) {
    const service = await Service.findById(id);
    if (!service) {
      throw new NotFoundError('Service not found');
    }
    return service;
  }

  async updateService(id, updateData) {
    // Category cannot be edited - ensure it's not in updateData
    delete updateData.category;
    // VehicleType is not a top-level field (it's in pricing array) - remove if sent
    delete updateData.vehicleType;

    const service = await Service.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!service) {
      throw new NotFoundError('Service not found');
    }
    return service;
  }

  async deleteService(id) {
    const service = await Service.findByIdAndDelete(id);
    if (!service) throw new NotFoundError('Service not found');
    return service;
  }
}

module.exports = new ServiceService();
