const addonService = require('../services/addon.service');

/**
 * Create a new add-on (Admin)
 */
const createAddon = async (req, res) => {
    const addon = await addonService.createAddon(req.body);
    res.status(201).json({ success: true, data: addon });
};

/**
 * Get all add-ons with filtering (Admin)
 */
const getAddons = async (req, res) => {
    const filters = {
        search: req.query.search,
        status: req.query.status,
        category: req.query.category,
        page: req.query.page || 1,
        limit: req.query.limit || 10,
        sortBy: req.query.sortBy || 'name',
        sortOrder: req.query.sortOrder || 'asc',
    };

    // Remove undefined values
    Object.keys(filters).forEach((k) => filters[k] === undefined && delete filters[k]);

    const result = await addonService.getAddons(filters);
    res.json({ success: true, data: result });
};

/**
 * Get a single add-on by ID
 */
const getAddonById = async (req, res) => {
    const { id } = req.params;
    const addon = await addonService.getAddonById(id);
    res.json({ success: true, data: addon });
};

/**
 * Update an add-on (Admin)
 */
const updateAddon = async (req, res) => {
    const { id } = req.params;
    const addon = await addonService.updateAddon(id, req.body);
    res.json({ success: true, data: addon });
};

/**
 * Delete an add-on (Admin)
 */
const deleteAddon = async (req, res) => {
    const { id } = req.params;
    await addonService.deleteAddon(id);
    res.json({ success: true, message: 'Add-on deleted successfully' });
};

/**
 * Get active add-ons for customers (Public)
 */
const getActiveAddons = async (req, res) => {
    const { category } = req.query;
    const addons = await addonService.getActiveAddons(category);
    res.json({ success: true, data: addons });
};

module.exports = {
    createAddon,
    getAddons,
    getAddonById,
    updateAddon,
    deleteAddon,
    getActiveAddons,
};
