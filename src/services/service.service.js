const Service = require('../models/service.model');
const Booking = require('../models/booking.model');
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
    const allowedSort = ['name', 'duration'];
    const sortField = allowedSort.includes(sortBy) ? sortBy : 'name';
    sort[sortField] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const total = await Service.countDocuments(query);
    const services = await Service.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get average ratings for all services
    const serviceIds = services.map(s => s._id.toString());
    const ratingsAgg = await Booking.aggregate([
      {
        $match: {
          serviceId: { $in: serviceIds },
          status: 'completed',
          'feedback.rating': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$serviceId',
          averageRating: { $avg: '$feedback.rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    const ratingsMap = new Map(ratingsAgg.map(r => [r._id, { averageRating: r.averageRating, totalReviews: r.totalReviews }]));

    const servicesWithRatings = services.map(service => ({
      ...service,
      averageRating: ratingsMap.get(service._id.toString())?.averageRating || null,
      totalReviews: ratingsMap.get(service._id.toString())?.totalReviews || 0
    }));

    return {
      data: servicesWithRatings,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  async getServiceById(id) {
    const service = await Service.findById(id).lean();
    if (!service) {
      throw new NotFoundError('Service not found');
    }

    // Get average rating for this service
    const ratingAgg = await Booking.aggregate([
      {
        $match: {
          serviceId: id,
          status: 'completed',
          'feedback.rating': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$feedback.rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    return {
      ...service,
      averageRating: ratingAgg[0]?.averageRating || null,
      totalReviews: ratingAgg[0]?.totalReviews || 0
    };
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

  async getServiceReviews(serviceId, options = {}) {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    // Get all completed bookings with feedback for this service
    const matchQuery = {
      serviceId: serviceId,
      status: 'completed',
      'feedback.rating': { $exists: true, $ne: null }
    };

    // Get total count
    const total = await Booking.countDocuments(matchQuery);

    // Get reviews with user info
    const bookings = await Booking.find(matchQuery)
      .populate('userId', 'name email')
      .sort({ 'feedback.submittedAt': -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const reviews = bookings.map(booking => ({
      id: booking._id.toString(),
      userName: booking.userId?.name || 'Anonymous',
      rating: booking.feedback.rating,
      comment: booking.feedback.comment || '',
      createdAt: booking.feedback.submittedAt || booking.updatedAt,
      serviceName: booking.serviceName,
    }));

    // Calculate average rating
    const avgResult = await Booking.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, avg: { $avg: '$feedback.rating' } } }
    ]);
    const averageRating = avgResult[0]?.avg || 0;

    return {
      reviews,
      averageRating,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  async deleteService(id) {
    const service = await Service.findByIdAndDelete(id);
    if (!service) throw new NotFoundError('Service not found');
    return service;
  }
}

module.exports = new ServiceService();
