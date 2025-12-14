const vehicleCategoryService = require('../services/vehicleCategory.service');

/**
 * Get all categories (admin)
 */
const getCategories = async (req, res, next) => {
    try {
        const data = await vehicleCategoryService.getCategories(req.query);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * Get active categories (public)
 */
const getActiveCategories = async (req, res, next) => {
    try {
        const data = await vehicleCategoryService.getActiveCategories();
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * Get category with its types
 */
const getCategoryWithTypes = async (req, res, next) => {
    try {
        const data = await vehicleCategoryService.getCategoryWithTypes(req.params.id);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * Create category (admin)
 */
const createCategory = async (req, res, next) => {
    try {
        const data = await vehicleCategoryService.createCategory(req.body);
        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * Update category (admin)
 */
const updateCategory = async (req, res, next) => {
    try {
        const data = await vehicleCategoryService.updateCategory(req.params.id, req.body);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete category (admin)
 */
const deleteCategory = async (req, res, next) => {
    try {
        const data = await vehicleCategoryService.deleteCategory(req.params.id);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * Count types in category
 */
const countTypesInCategory = async (req, res, next) => {
    try {
        const count = await vehicleCategoryService.countTypesInCategory(req.params.slug);
        res.json({ success: true, data: { count } });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getCategories,
    getActiveCategories,
    getCategoryWithTypes,
    createCategory,
    updateCategory,
    deleteCategory,
    countTypesInCategory,
};
