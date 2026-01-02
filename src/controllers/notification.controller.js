const notificationService = require('../services/notification.service');

/**
 * Get user notifications
 */
async function getNotifications(req, res, next) {
    try {
        const { page = 1, limit = 10, read } = req.query;

        const result = await notificationService.getNotifications(req.userId, {
            page: parseInt(page),
            limit: parseInt(limit),
            read: read !== undefined ? read === 'true' : undefined
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Mark single notification as read
 */
async function markAsRead(req, res, next) {
    try {
        const { id } = req.params;

        const notification = await notificationService.markAsRead(id, req.userId);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            data: { message: 'Notification marked as read' }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead(req, res, next) {
    try {
        await notificationService.markAllAsRead(req.userId);

        res.json({
            success: true,
            data: { message: 'All notifications marked as read' }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Subscribe to push notifications
 */
async function subscribePush(req, res, next) {
    try {
        const { subscription } = req.body;

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({
                success: false,
                message: 'Invalid subscription object'
            });
        }

        await notificationService.saveSubscription(
            req.userId,
            subscription,
            req.headers['user-agent']
        );

        res.json({
            success: true,
            data: { message: 'Push subscription saved' }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Unsubscribe from push notifications
 */
async function unsubscribePush(req, res, next) {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({
                success: false,
                message: 'Endpoint is required'
            });
        }

        await notificationService.removeSubscription(endpoint);

        res.json({
            success: true,
            data: { message: 'Push subscription removed' }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get VAPID public key for frontend
 */
function getVapidPublicKey(req, res) {
    res.json({
        success: true,
        data: {
            publicKey: process.env.VAPID_PUBLIC_KEY || null
        }
    });
}

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead,
    subscribePush,
    unsubscribePush,
    getVapidPublicKey
};
