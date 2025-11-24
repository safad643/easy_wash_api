const Banner = require('../models/banner.model');
const { BadRequestError, NotFoundError } = require('../utils/errors');

class BannerService {
  async createBanner(bannerData) {
    // Validate date range if both dates are provided
    if (bannerData.startDate && bannerData.endDate) {
      const startDate = new Date(bannerData.startDate);
      const endDate = new Date(bannerData.endDate);
      
      if (endDate < startDate) {
        throw new BadRequestError('End date must be after start date');
      }
    }

    // If no order is provided, set it to the next available order
    if (bannerData.order === undefined) {
      const maxOrderBanner = await Banner.findOne({ position: bannerData.position || 'hero' })
        .sort({ order: -1 });
      bannerData.order = maxOrderBanner ? maxOrderBanner.order + 1 : 0;
    }

    const banner = new Banner(bannerData);
    await banner.save();
    return banner;
  }

  async getBanners(filters = {}) {
    const {
      search,
      status,
      position,
      page = 1,
      limit = 10,
      active,
    } = filters;

    const query = {};

    // Handle status filter (support both 'active'/'inactive' and boolean)
    if (status !== undefined) {
      if (status === 'active') {
        query.active = true;
      } else if (status === 'inactive') {
        query.active = false;
      }
    } else if (active !== undefined) {
      query.active = active === true || active === 'true';
    }

    if (position) {
      query.position = position;
    }

    // Search by title or description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subtitle: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const banners = await Banner.find(query)
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Banner.countDocuments(query);

    return {
      data: banners,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    };
  }

  async getActiveBanners(position = 'hero') {
    const now = new Date();
    
    // Build query for active banners within date range
    const finalQuery = {
      active: true,
      position,
      $and: [
        {
          $or: [
            { startDate: { $exists: false } },
            { startDate: null },
            { startDate: { $lte: now } },
          ],
        },
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: null },
            { endDate: { $gte: now } },
          ],
        },
      ],
    };

    const banners = await Banner.find(finalQuery)
      .sort({ order: 1, createdAt: -1 })
      .select('title subtitle description imageUrl ctaText ctaLink position order');

    return banners;
  }

  async getBannerById(bannerId) {
    const banner = await Banner.findById(bannerId);
    if (!banner) {
      throw new NotFoundError('Banner not found');
    }
    return banner;
  }

  async updateBanner(bannerId, updateData) {
    // Validate date range if both dates are provided
    if (updateData.startDate && updateData.endDate) {
      const startDate = new Date(updateData.startDate);
      const endDate = new Date(updateData.endDate);
      
      if (endDate < startDate) {
        throw new BadRequestError('End date must be after start date');
      }
    }

    // Handle status update - convert 'active'/'inactive' to boolean
    if (updateData.status) {
      updateData.active = updateData.status === 'active';
      delete updateData.status;
    }

    // Prevent changing these fields
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.impressions;
    delete updateData.clicks;

    const banner = await Banner.findByIdAndUpdate(
      bannerId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!banner) {
      throw new NotFoundError('Banner not found');
    }

    return banner;
  }

  async deleteBanner(bannerId) {
    const banner = await Banner.findByIdAndDelete(bannerId);
    if (!banner) {
      throw new NotFoundError('Banner not found');
    }
    return { message: 'Banner deleted successfully' };
  }

  async incrementImpression(bannerId) {
    await Banner.findByIdAndUpdate(bannerId, {
      $inc: { impressions: 1 },
    });
  }

  async incrementClick(bannerId) {
    await Banner.findByIdAndUpdate(bannerId, {
      $inc: { clicks: 1 },
    });
  }
}

module.exports = new BannerService();

