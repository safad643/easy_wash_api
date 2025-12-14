const vehicleTypeService = require('../services/vehicleType.service');

/**
 * Get vehicle types (admin - all, public - active only)
 */
const getVehicleTypes = async (req, res, next) => {
    try {
        const result = await vehicleTypeService.getVehicleTypes(req.query);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * Get active vehicle types (public/customer)
 */
const getActiveVehicleTypes = async (req, res, next) => {
    try {
        const { category } = req.query;
        const data = await vehicleTypeService.getActiveVehicleTypes(category);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * Get single vehicle type by ID
 */
const getVehicleTypeById = async (req, res, next) => {
    try {
        const data = await vehicleTypeService.getVehicleTypeById(req.params.id);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * Create vehicle type (admin only)
 */
const createVehicleType = async (req, res, next) => {
    try {
        const data = await vehicleTypeService.createVehicleType(req.body);
        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * Update vehicle type (admin only)
 */
const updateVehicleType = async (req, res, next) => {
    try {
        const data = await vehicleTypeService.updateVehicleType(req.params.id, req.body);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete vehicle type (admin only)
 */
const deleteVehicleType = async (req, res, next) => {
    try {
        const data = await vehicleTypeService.deleteVehicleType(req.params.id);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * Count services affected by a vehicle type (for warning display)
 */
const countAffectedServices = async (req, res, next) => {
    try {
        const { bodyType } = req.params;
        const count = await vehicleTypeService.countAffectedServices(bodyType);
        res.json({ success: true, data: { count } });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getVehicleTypes,
    getActiveVehicleTypes,
    getVehicleTypeById,
    createVehicleType,
    updateVehicleType,
    deleteVehicleType,
    countAffectedServices,
};
