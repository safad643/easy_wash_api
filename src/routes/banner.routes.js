const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/banner.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Public routes (anyone can view active banners)
router.get('/public', bannerController.getActiveBanners);

// Admin-only routes
router.post('/', authenticate, authorize('admin'), bannerController.createBanner);
router.get('/', authenticate, authorize('admin'), bannerController.getBanners);
router.get('/:id', authenticate, authorize('admin'), bannerController.getBannerById);
router.patch('/:id', authenticate, authorize('admin'), bannerController.updateBanner);
router.delete('/:id', authenticate, authorize('admin'), bannerController.deleteBanner);

// Analytics tracking (public, no auth required)
router.post('/:id/impression', bannerController.trackImpression);
router.post('/:id/click', bannerController.trackClick);

module.exports = router;

