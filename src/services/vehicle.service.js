const Vehicle = require('../models/vehicle.model');
const VehicleType = require('../models/vehicleType.model');
const { NotFoundError, UnauthorizedError, BadRequestError } = require('../utils/errors');

class VehicleService {
  async listUserVehicles(userId) {
    return Vehicle.find({ user: userId }).sort({ isPrimary: -1, updatedAt: -1 });
  }

  async createVehicle(userId, input) {
    // Validate vehicle type exists and is active
    const typeExists = await VehicleType.findOne({
      category: input.category,
      bodyType: input.bodyType.toLowerCase(),
      isActive: true,
    });

    if (!typeExists) {
      throw new BadRequestError('Invalid vehicle type. Please select a valid vehicle type.');
    }

    const count = await Vehicle.countDocuments({ user: userId });

    const vehicle = await Vehicle.create({
      user: userId,
      ...input,
      bodyType: input.bodyType.toLowerCase(),
      isPrimary: count === 0 ? true : Boolean(input.isPrimary),
    });

    if (vehicle.isPrimary) {
      await Vehicle.updateMany(
        { user: userId, _id: { $ne: vehicle._id } },
        { $set: { isPrimary: false } }
      );
    }

    return vehicle;
  }

  async updateVehicle(userId, vehicleId, updates) {
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) throw new NotFoundError('Vehicle not found');
    if (String(vehicle.user) !== String(userId)) throw new UnauthorizedError('Not allowed');

    // Only allow updating isPrimary - category and bodyType cannot be changed
    // Users must delete and re-add the vehicle to change these
    if (updates.isPrimary !== undefined) {
      vehicle.isPrimary = updates.isPrimary;
    }

    await vehicle.save();

    if (vehicle.isPrimary) {
      await Vehicle.updateMany(
        { user: userId, _id: { $ne: vehicleId } },
        { $set: { isPrimary: false } }
      );
    }

    return vehicle;
  }

  async deleteVehicle(userId, vehicleId) {
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) throw new NotFoundError('Vehicle not found');
    if (String(vehicle.user) !== String(userId)) throw new UnauthorizedError('Not allowed');

    const wasPrimary = vehicle.isPrimary;
    await vehicle.deleteOne();

    if (wasPrimary) {
      const next = await Vehicle.findOne({ user: userId }).sort({ updatedAt: -1 });
      if (next) {
        next.isPrimary = true;
        await next.save();
      }
    }

    return { message: 'Vehicle deleted successfully' };
  }
}

module.exports = new VehicleService();


