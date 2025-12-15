const Addon = require('../models/addon.model');
const { NotFoundError, BadRequestError } = require('../utils/errors');

class AddonService {
    /**
     * Create a new add-on
     */
    async createAddon(data) {
        const addon = new Addon(data);
        await addon.save();
        return addon;
    }

    /**
     * Get all add-ons with filtering and pagination (Admin)
     */
    async getAddons(filters = {}) {
        const {
            search,
            status, // 'active' | 'inactive'
            category, // 'car' | 'bike'
            page = 1,
            limit = 10,
            sortBy = 'name',
            sortOrder = 'asc',
        } = filters;

        const query = {};

        // Filter by active status
        if (status) {
            query.isActive = status === 'active';
        }

        // Filter by applicable category
        if (category && ['car', 'bike'].includes(category)) {
            query.applicableCategories = category;
        }

        // Text search
        if (search) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [
                { name: { $regex: escapedSearch, $options: 'i' } },
                { description: { $regex: escapedSearch, $options: 'i' } },
            ];
        }

        // Sorting
        const sort = {};
        const allowedSort = ['name', 'price', 'duration', 'createdAt'];
        const sortField = allowedSort.includes(sortBy) ? sortBy : 'name';
        sort[sortField] = sortOrder === 'asc' ? 1 : -1;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const total = await Addon.countDocuments(query);
        const addons = await Addon.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        return {
            data: addons,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
        };
    }

    /**
     * Get a single add-on by ID
     */
    async getAddonById(id) {
        const addon = await Addon.findById(id).lean();
        if (!addon) {
            throw new NotFoundError('Add-on not found');
        }
        return addon;
    }

    /**
     * Update an add-on
     */
    async updateAddon(id, updateData) {
        // Prevent updating internal fields
        delete updateData._id;
        delete updateData.createdAt;
        delete updateData.updatedAt;

        const addon = await Addon.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        }).lean();

        if (!addon) {
            throw new NotFoundError('Add-on not found');
        }
        return addon;
    }

    /**
     * Delete an add-on
     */
    async deleteAddon(id) {
        const addon = await Addon.findByIdAndDelete(id);
        if (!addon) {
            throw new NotFoundError('Add-on not found');
        }
        return addon;
    }

    /**
     * Get active add-ons for customers (Public)
     * Optionally filtered by vehicle category
     */
    async getActiveAddons(category = null) {
        const query = { isActive: true };

        if (category && ['car', 'bike'].includes(category)) {
            query.applicableCategories = category;
        }

        const addons = await Addon.find(query)
            .select('name description price duration applicableCategories image')
            .sort({ name: 1 })
            .lean();

        return addons;
    }

    /**
     * Get multiple add-ons by IDs (for pricing calculations)
     */
    async getAddonsByIds(ids) {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return [];
        }

        const addons = await Addon.find({
            _id: { $in: ids },
            isActive: true,
        })
            .select('name price duration')
            .lean();

        return addons;
    }
}

module.exports = new AddonService();
