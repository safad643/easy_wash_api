const posterService = require('../services/poster.service');

// Create poster (Admin)
exports.createPoster = async (req, res, next) => {
    try {
        // Map frontend field names to backend
        const data = { ...req.body };
        if ('active' in data) {
            data.isActive = data.active;
            delete data.active;
        }

        const poster = await posterService.createPoster(data);
        res.status(201).json({
            success: true,
            message: 'Poster created successfully',
            data: poster,
        });
    } catch (error) {
        next(error);
    }
};

// Get all posters with pagination (Admin)
exports.getPosters = async (req, res, next) => {
    try {
        const result = await posterService.getPosters(req.query);
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

// Get active posters for landing page (Public)
exports.getActivePosters = async (req, res, next) => {
    try {
        const posters = await posterService.getActivePosters();
        res.json({
            success: true,
            data: posters,
        });
    } catch (error) {
        next(error);
    }
};

// Get single poster by ID (Admin)
exports.getPosterById = async (req, res, next) => {
    try {
        const poster = await posterService.getPosterById(req.params.id);
        if (!poster) {
            return res.status(404).json({
                success: false,
                message: 'Poster not found',
            });
        }
        res.json({
            success: true,
            data: poster,
        });
    } catch (error) {
        next(error);
    }
};

// Update poster (Admin)
exports.updatePoster = async (req, res, next) => {
    try {
        const poster = await posterService.updatePoster(req.params.id, req.body);
        if (!poster) {
            return res.status(404).json({
                success: false,
                message: 'Poster not found',
            });
        }
        res.json({
            success: true,
            message: 'Poster updated successfully',
            data: poster,
        });
    } catch (error) {
        next(error);
    }
};

// Delete poster (Admin)
exports.deletePoster = async (req, res, next) => {
    try {
        const deleted = await posterService.deletePoster(req.params.id);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Poster not found',
            });
        }
        res.json({
            success: true,
            message: 'Poster deleted successfully',
            data: { message: 'Poster deleted successfully' },
        });
    } catch (error) {
        next(error);
    }
};
