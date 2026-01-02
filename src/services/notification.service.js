const webpush = require('web-push');
const Notification = require('../models/notification.model');
const PushSubscription = require('../models/pushSubscription.model');

// Configure web-push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@easywash.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

/**
 * Create a notification and send push to user's devices
 */
async function createNotification(userId, { title, message, type = 'system', data = {}, actionUrl }) {
    // Save to database
    const notification = await Notification.create({
        userId,
        title,
        message,
        type,
        data,
        actionUrl
    });

    // Send push notification to all user's subscribed devices
    await sendPushToUser(userId, {
        title,
        body: message,
        icon: '/images/logo.png',
        badge: '/images/badge.png',
        data: {
            notificationId: notification._id.toString(),
            actionUrl,
            type,
            ...data
        }
    });

    return notification;
}

/**
 * Send push notification to all devices of a user
 */
async function sendPushToUser(userId, payload) {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        console.log('VAPID keys not configured, skipping push notification');
        return;
    }

    const subscriptions = await PushSubscription.find({ userId });

    const pushPromises = subscriptions.map(async (sub) => {
        try {
            await webpush.sendNotification(
                {
                    endpoint: sub.endpoint,
                    keys: sub.keys
                },
                JSON.stringify(payload)
            );
        } catch (error) {
            // If subscription is expired/invalid, remove it
            if (error.statusCode === 410 || error.statusCode === 404) {
                await PushSubscription.findByIdAndDelete(sub._id);
                console.log(`Removed expired subscription for user ${userId}`);
            } else {
                console.error('Push notification error:', error.message);
            }
        }
    });

    await Promise.allSettled(pushPromises);
}

/**
 * Save a push subscription for a user
 */
async function saveSubscription(userId, subscription, userAgent) {
    // Upsert - update if endpoint exists, create if not
    return PushSubscription.findOneAndUpdate(
        { endpoint: subscription.endpoint },
        {
            userId,
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            userAgent
        },
        { upsert: true, new: true }
    );
}

/**
 * Remove a push subscription
 */
async function removeSubscription(endpoint) {
    return PushSubscription.findOneAndDelete({ endpoint });
}

/**
 * Get notifications for a user with pagination
 */
async function getNotifications(userId, { page = 1, limit = 10, read } = {}) {
    const query = { userId };
    if (read !== undefined) {
        query.read = read;
    }

    const [notifications, total] = await Promise.all([
        Notification.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Notification.countDocuments(query)
    ]);

    return {
        data: notifications.map(n => ({
            id: n._id.toString(),
            userId: n.userId.toString(),
            title: n.title,
            message: n.message,
            type: n.type,
            data: n.data,
            read: n.read,
            actionUrl: n.actionUrl,
            createdAt: n.createdAt.toISOString()
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
    };
}

/**
 * Mark notification as read
 */
async function markAsRead(notificationId, userId) {
    return Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { read: true },
        { new: true }
    );
}

/**
 * Mark all notifications as read for a user
 */
async function markAllAsRead(userId) {
    return Notification.updateMany(
        { userId, read: false },
        { read: true }
    );
}

module.exports = {
    createNotification,
    sendPushToUser,
    saveSubscription,
    removeSubscription,
    getNotifications,
    markAsRead,
    markAllAsRead
};
