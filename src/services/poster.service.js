const Poster = require('../models/poster.model');

class PosterService {
    // Create new poster
    async createPoster(data) {
        const poster = new Poster(data);
        await poster.save();
        return poster;
    }

    // Get paginated poster list for admin
    async getPosters(filters = {}) {
        const {
            search,
            status,
            page = 1,
            limit = 10,
        } = filters;

        const query = {};

        // Search by title
        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }

        // Filter by status
        if (status === 'active') {
            query.isActive = true;
        } else if (status === 'inactive') {
            query.isActive = false;
        }

        const skip = (page - 1) * limit;

        const [posters, total] = await Promise.all([
            Poster.find(query)
                .sort({ displayOrder: 1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Poster.countDocuments(query),
        ]);

        // Transform for frontend
        const transformedPosters = posters.map(poster => ({
            id: poster._id.toString(),
            title: poster.title,
            description: poster.description || '',
            image: poster.image,
            endDate: poster.endDate ? poster.endDate.toISOString().split('T')[0] : '',
            headingColor: poster.headingColor || '#ffffff',
            descriptionColor: poster.descriptionColor || '#ffffff',
            showButton: poster.showButton || false,
            buttonText: poster.buttonText || '',
            buttonLink: poster.buttonLink || '',
            status: poster.isActive ? 'active' : 'inactive',
            displayOrder: poster.displayOrder || 0,
            location: 'Home Page', // For admin display
            startDate: poster.createdAt ? poster.createdAt.toISOString().split('T')[0] : '',
        }));

        return {
            data: transformedPosters,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
        };
    }

    // Get active posters for landing page (public)
    async getActivePosters() {
        const now = new Date();

        const posters = await Poster.find({
            isActive: true,
            endDate: { $gte: now },
        })
            .sort({ displayOrder: 1, createdAt: -1 })
            .lean();

        return posters.map(poster => ({
            id: poster._id.toString(),
            title: poster.title,
            description: poster.description || '',
            image: poster.image,
            headingColor: poster.headingColor || '#ffffff',
            descriptionColor: poster.descriptionColor || '#ffffff',
            showButton: poster.showButton || false,
            buttonText: poster.buttonText || '',
            buttonLink: poster.buttonLink || '',
        }));
    }

    // Get single poster by ID
    async getPosterById(id) {
        const poster = await Poster.findById(id).lean();
        if (!poster) {
            return null;
        }

        return {
            id: poster._id.toString(),
            title: poster.title,
            description: poster.description || '',
            image: poster.image,
            endDate: poster.endDate ? poster.endDate.toISOString().split('T')[0] : '',
            headingColor: poster.headingColor || '#ffffff',
            descriptionColor: poster.descriptionColor || '#ffffff',
            showButton: poster.showButton || false,
            buttonText: poster.buttonText || '',
            buttonLink: poster.buttonLink || '',
            active: poster.isActive,
            displayOrder: poster.displayOrder || 0,
        };
    }

    // Update poster
    async updatePoster(id, data) {
        // Map frontend field names to backend field names
        const updateData = { ...data };
        if ('active' in updateData) {
            updateData.isActive = updateData.active;
            delete updateData.active;
        }

        const poster = await Poster.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).lean();

        if (!poster) {
            return null;
        }

        return {
            id: poster._id.toString(),
            title: poster.title,
            description: poster.description || '',
            image: poster.image,
            endDate: poster.endDate ? poster.endDate.toISOString().split('T')[0] : '',
            headingColor: poster.headingColor || '#ffffff',
            descriptionColor: poster.descriptionColor || '#ffffff',
            showButton: poster.showButton || false,
            buttonText: poster.buttonText || '',
            buttonLink: poster.buttonLink || '',
            active: poster.isActive,
            displayOrder: poster.displayOrder || 0,
        };
    }

    // Delete poster
    async deletePoster(id) {
        const result = await Poster.findByIdAndDelete(id);
        return !!result;
    }
}

module.exports = new PosterService();
