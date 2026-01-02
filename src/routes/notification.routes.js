const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Public route - get VAPID key (needed before auth for subscription)
router.get('/push/vapid-key', notificationController.getVapidPublicKey);

// Protected routes
router.use(authenticate);

// Notifications CRUD
router.get('/', notificationController.getNotifications);
router.post('/:id/read', notificationController.markAsRead);
router.post('/read-all', notificationController.markAllAsRead);

// Push subscription management
router.post('/push/subscribe', notificationController.subscribePush);
router.post('/push/unsubscribe', notificationController.unsubscribePush);

module.exports = router;
