const VehicleType = require('../models/vehicleType.model');
const Service = require('../models/service.model');
const { BadRequestError, NotFoundError } = require('../utils/errors');

class VehicleTypeService {
    /**
     * Get vehicle types with filters (for admin)
     */
    async getVehicleTypes(filters = {}) {
        const {
            category,
            status,
            search,
            page = 1,
            limit = 50,
            sortBy = 'displayOrder',
            sortOrder = 'asc',
        } = filters;

        const query = {};

        if (category) {
            query.category = category;
        }

        if (status === 'active') {
            query.isActive = true;
        } else if (status === 'inactive') {
            query.isActive = false;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { bodyType: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (page - 1) * limit;
        const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        const [data, total] = await Promise.all([
            VehicleType.find(query).sort(sortOptions).skip(skip).limit(parseInt(limit)),
            VehicleType.countDocuments(query),
        ]);

        return {
            data,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Get active vehicle types (for public/customer use)
     */
    async getActiveVehicleTypes(category = null) {
        const query = { isActive: true };
        if (category) {
            query.category = category;
        }
        return VehicleType.find(query).sort({ category: 1, displayOrder: 1 });
    }

    /**
     * Get single vehicle type by ID
     */
    async getVehicleTypeById(id) {
        const vehicleType = await VehicleType.findById(id);
        if (!vehicleType) {
            throw new NotFoundError('Vehicle type not found');
        }
        return vehicleType;
    }

    /**
     * Create a new vehicle type
     */
    async createVehicleType(data) {
        // Check for duplicates
        const existing = await VehicleType.findOne({
            category: data.category,
            bodyType: data.bodyType.toLowerCase(),
        });

        if (existing) {
            throw new BadRequestError(
                `Vehicle type "${data.bodyType}" already exists for ${data.category}`
            );
        }

        const vehicleType = new VehicleType({
            ...data,
            bodyType: data.bodyType.toLowerCase(),
        });

        await vehicleType.save();
        return vehicleType;
    }

    /**
     * Update a vehicle type (with cascade to services if bodyType changes)
     */
    async updateVehicleType(id, updates) {
        const vehicleType = await VehicleType.findById(id);
        if (!vehicleType) {
            throw new NotFoundError('Vehicle type not found');
        }

        const oldBodyType = vehicleType.bodyType;
        const newBodyType = updates.bodyType
            ? updates.bodyType.toLowerCase()
            : oldBodyType;

        // Check for duplicates if bodyType is changing
        if (newBodyType !== oldBodyType) {
            const duplicate = await VehicleType.findOne({
                category: vehicleType.category,
                bodyType: newBodyType,
                _id: { $ne: id },
            });

            if (duplicate) {
                throw new BadRequestError(
                    `Vehicle type "${newBodyType}" already exists for ${vehicleType.category}`
                );
            }

            // Cascade update to services
            await Service.updateMany(
                { 'pricing.vehicleType': oldBodyType },
                { $set: { 'pricing.$[elem].vehicleType': newBodyType } },
                { arrayFilters: [{ 'elem.vehicleType': oldBodyType }] }
            );
        }

        // Apply updates
        if (updates.name !== undefined) vehicleType.name = updates.name;
        if (updates.bodyType !== undefined) vehicleType.bodyType = newBodyType;
        if (updates.icon !== undefined) vehicleType.icon = updates.icon;
        if (updates.displayOrder !== undefined) vehicleType.displayOrder = updates.displayOrder;
        if (updates.isActive !== undefined) vehicleType.isActive = updates.isActive;

        await vehicleType.save();
        return vehicleType;
    }

    /**
     * Delete a vehicle type (with cascade removal from services)
     */
    async deleteVehicleType(id) {
        const vehicleType = await VehicleType.findById(id);
        if (!vehicleType) {
            throw new NotFoundError('Vehicle type not found');
        }

        // Cascade: Remove pricing entries from all services
        await Service.updateMany(
            { 'pricing.vehicleType': vehicleType.bodyType },
            { $pull: { pricing: { vehicleType: vehicleType.bodyType } } }
        );

        await vehicleType.deleteOne();
        return { message: 'Vehicle type deleted successfully' };
    }

    /**
     * Check if a vehicle type exists and is active
     */
    async checkVehicleTypeExists(category, bodyType) {
        const exists = await VehicleType.findOne({
            category,
            bodyType: bodyType.toLowerCase(),
            isActive: true,
        });
        return !!exists;
    }

    /**
     * Count services affected by a vehicle type (for warning display)
     */
    async countAffectedServices(bodyType) {
        return Service.countDocuments({
            'pricing.vehicleType': bodyType.toLowerCase(),
        });
    }
}

module.exports = new VehicleTypeService();
