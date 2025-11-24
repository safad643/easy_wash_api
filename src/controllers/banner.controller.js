const bannerService = require('../services/banner.service');
const { BadRequestError } = require('../utils/errors');

const createBanner = async (req, res, next) => {
  try {
    const bannerData = req.body;
    
    // Map frontend fields to backend fields
    const mappedData = {
      title: bannerData.title,
      subtitle: bannerData.subtitle,
      description: bannerData.description,
      imageUrl: bannerData.image || bannerData.imageUrl,
      ctaText: bannerData.ctaText || bannerData.ctaText || 'Learn More',
      ctaLink: bannerData.link || bannerData.ctaLink,
      position: bannerData.position || 'hero',
      pages: bannerData.pages || ['home'],
      startDate: bannerData.startDate ? new Date(bannerData.startDate) : undefined,
      endDate: bannerData.endDate ? new Date(bannerData.endDate) : undefined,
      active: bannerData.active !== undefined ? bannerData.active : true,
      order: bannerData.displayOrder !== undefined ? bannerData.displayOrder : bannerData.order,
    };

    const banner = await bannerService.createBanner(mappedData);
    res.status(201).json({
      success: true,
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

const getBanners = async (req, res, next) => {
  try {
    const filters = {
      search: req.query.search,
      status: req.query.status,
      position: req.query.position,
      page: req.query.page || 1,
      limit: req.query.limit || req.query.pageSize || 10,
      active: req.query.active,
    };

    // Remove undefined values
    Object.keys(filters).forEach(
      (key) => filters[key] === undefined && delete filters[key]
    );

    const result = await bannerService.getBanners(filters);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getActiveBanners = async (req, res, next) => {
  try {
    const position = req.query.position || 'hero';
    const banners = await bannerService.getActiveBanners(position);
    res.json({
      success: true,
      data: banners,
    });
  } catch (error) {
    next(error);
  }
};

const getBannerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const banner = await bannerService.getBannerById(id);
    res.json({
      success: true,
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

const updateBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Map frontend fields to backend fields
    const mappedData = {};
    if (updateData.title !== undefined) mappedData.title = updateData.title;
    if (updateData.subtitle !== undefined) mappedData.subtitle = updateData.subtitle;
    if (updateData.description !== undefined) mappedData.description = updateData.description;
    if (updateData.image !== undefined) mappedData.imageUrl = updateData.image;
    if (updateData.imageUrl !== undefined) mappedData.imageUrl = updateData.imageUrl;
    if (updateData.ctaText !== undefined) mappedData.ctaText = updateData.ctaText;
    if (updateData.link !== undefined) mappedData.ctaLink = updateData.link;
    if (updateData.ctaLink !== undefined) mappedData.ctaLink = updateData.ctaLink;
    if (updateData.position !== undefined) mappedData.position = updateData.position;
    if (updateData.pages !== undefined) mappedData.pages = updateData.pages;
    if (updateData.startDate !== undefined) mappedData.startDate = new Date(updateData.startDate);
    if (updateData.endDate !== undefined) mappedData.endDate = new Date(updateData.endDate);
    if (updateData.active !== undefined) mappedData.active = updateData.active;
    if (updateData.status !== undefined) mappedData.status = updateData.status;
    if (updateData.displayOrder !== undefined) mappedData.order = updateData.displayOrder;
    if (updateData.order !== undefined) mappedData.order = updateData.order;

    const banner = await bannerService.updateBanner(id, mappedData);
    res.json({
      success: true,
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

const deleteBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await bannerService.deleteBanner(id);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const trackImpression = async (req, res, next) => {
  try {
    const { id } = req.params;
    await bannerService.incrementImpression(id);
    res.json({
      success: true,
      message: 'Impression tracked',
    });
  } catch (error) {
    next(error);
  }
};

const trackClick = async (req, res, next) => {
  try {
    const { id } = req.params;
    await bannerService.incrementClick(id);
    res.json({
      success: true,
      message: 'Click tracked',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBanner,
  getBanners,
  getActiveBanners,
  getBannerById,
  updateBanner,
  deleteBanner,
  trackImpression,
  trackClick,
};

