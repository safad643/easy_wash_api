const Vehicle = require('../models/vehicle.model');
const { NotFoundError, UnauthorizedError } = require('../utils/errors');

class VehicleService {
  async listUserVehicles(userId) {
    return Vehicle.find({ user: userId }).sort({ isPrimary: -1, updatedAt: -1 });
  }

  async createVehicle(userId, input) {
    const count = await Vehicle.countDocuments({ user: userId });

    const vehicle = await Vehicle.create({
      user: userId,
      ...input,
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

    const allowed = [
      'type',
      'brand',
      'model',
      'year',
      'plateNumber',
      'color',
      'fuelType',
      'isPrimary',
    ];

    for (const key of Object.keys(updates)) {
      if (allowed.includes(key)) vehicle[key] = updates[key];
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


