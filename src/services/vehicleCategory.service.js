const VehicleCategory = require('../models/vehicleCategory.model');
const VehicleType = require('../models/vehicleType.model');
const Service = require('../models/service.model');
const { BadRequestError, NotFoundError } = require('../utils/errors');

class VehicleCategoryService {
    /**
     * Get all categories (for admin)
     */
    async getCategories(filters = {}) {
        const { status, search } = filters;
        const query = {};

        if (status === 'active') query.isActive = true;
        else if (status === 'inactive') query.isActive = false;

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        return VehicleCategory.find(query).sort({ displayOrder: 1, name: 1 });
    }

    /**
     * Get active categories (for public/customer)
     */
    async getActiveCategories() {
        return VehicleCategory.find({ isActive: true }).sort({ displayOrder: 1 });
    }

    /**
     * Create a new category
     */
    async createCategory(data) {
        const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-');

        const existing = await VehicleCategory.findOne({ slug });
        if (existing) {
            throw new BadRequestError(`Category "${data.name}" already exists`);
        }

        const category = new VehicleCategory({
            ...data,
            slug,
        });

        await category.save();
        return category;
    }

    /**
     * Update a category
     */
    async updateCategory(id, updates) {
        const category = await VehicleCategory.findById(id);
        if (!category) {
            throw new NotFoundError('Category not found');
        }

        const oldSlug = category.slug;

        if (updates.name !== undefined) category.name = updates.name;
        if (updates.slug !== undefined) {
            const newSlug = updates.slug.toLowerCase().replace(/\s+/g, '-');
            if (newSlug !== oldSlug) {
                const duplicate = await VehicleCategory.findOne({ slug: newSlug, _id: { $ne: id } });
                if (duplicate) {
                    throw new BadRequestError(`Category with slug "${newSlug}" already exists`);
                }
                category.slug = newSlug;

                // Cascade update to vehicle types
                await VehicleType.updateMany(
                    { category: oldSlug },
                    { $set: { category: newSlug } }
                );
            }
        }
        if (updates.icon !== undefined) category.icon = updates.icon;
        if (updates.displayOrder !== undefined) category.displayOrder = updates.displayOrder;
        if (updates.isActive !== undefined) category.isActive = updates.isActive;

        await category.save();
        return category;
    }

    /**
     * Delete a category (and its vehicle types)
     */
    async deleteCategory(id) {
        const category = await VehicleCategory.findById(id);
        if (!category) {
            throw new NotFoundError('Category not found');
        }

        // Delete all vehicle types in this category
        await VehicleType.deleteMany({ category: category.slug });

        // Remove pricing from services that use this category's types
        // (handled by vehicleType deletion)

        await category.deleteOne();
        return { message: 'Category and its types deleted successfully' };
    }

    /**
     * Get category with its types
     */
    async getCategoryWithTypes(id) {
        const category = await VehicleCategory.findById(id);
        if (!category) {
            throw new NotFoundError('Category not found');
        }

        const types = await VehicleType.find({ category: category.slug })
            .sort({ displayOrder: 1 });

        return { category, types };
    }

    /**
     * Count types in a category
     */
    async countTypesInCategory(slug) {
        return VehicleType.countDocuments({ category: slug });
    }
}

module.exports = new VehicleCategoryService();
