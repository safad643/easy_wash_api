const Booking = require('../models/booking.model');
const ProductOrder = require('../models/productOrder.model');
const { NotFoundError, BadRequestError } = require('../utils/errors');

class RefundController {
    // List bookings and orders with refunds
    async getRefunds(req, res) {
        const {
            status = 'pending',
            fromDate,
            toDate,
            page = 1,
            limit = 10,
        } = req.query || {};

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // --- Booking refunds query ---
        const bookingQuery = {
            status: 'cancelled',
            'refund.status': { $in: status === 'all' ? ['pending', 'processed'] : [status] },
        };

        if (fromDate || toDate) {
            bookingQuery['refund.requestedAt'] = {};
            if (fromDate) {
                bookingQuery['refund.requestedAt'].$gte = new Date(fromDate);
            }
            if (toDate) {
                const toDateEnd = new Date(toDate);
                toDateEnd.setHours(23, 59, 59, 999);
                bookingQuery['refund.requestedAt'].$lte = toDateEnd;
            }
        }

        // --- Order refunds query ---
        // Orders with paymentStatus = 'refunded' are processed refunds
        // Orders that are cancelled but not yet refunded are pending
        let orderQuery = {};
        if (status === 'pending') {
            // Cancelled orders that need refund processing
            orderQuery = {
                status: { $in: ['cancelled', 'returned'] },
                paymentStatus: { $in: ['paid', 'pending', 'processing'] },
            };
        } else if (status === 'processed') {
            // Any order that has been refunded (regardless of order status)
            orderQuery = {
                paymentStatus: 'refunded',
            };
        } else if (status === 'all') {
            orderQuery = {
                $or: [
                    { status: { $in: ['cancelled', 'returned'] }, paymentStatus: { $in: ['paid', 'pending', 'processing'] } },
                    { paymentStatus: 'refunded' },
                ],
            };
        }

        if (fromDate || toDate) {
            orderQuery.updatedAt = {};
            if (fromDate) {
                orderQuery.updatedAt.$gte = new Date(fromDate);
            }
            if (toDate) {
                const toDateEnd = new Date(toDate);
                toDateEnd.setHours(23, 59, 59, 999);
                orderQuery.updatedAt.$lte = toDateEnd;
            }
        }

        // Get counts
        const bookingCount = await Booking.countDocuments(bookingQuery);
        const orderCount = await ProductOrder.countDocuments(orderQuery);
        const total = bookingCount + orderCount;

        // Fetch bookings
        const bookings = await Booking.find(bookingQuery)
            .populate({
                path: 'userId',
                select: 'name email phone',
                options: { lean: true }
            })
            .sort({ 'refund.requestedAt': -1 })
            .lean()
            .exec();

        // Fetch orders
        const orders = await ProductOrder.find(orderQuery)
            .populate({
                path: 'userId',
                select: 'name email phone',
                options: { lean: true }
            })
            .sort({ updatedAt: -1 })
            .lean()
            .exec();

        // Format booking refunds
        const formattedBookings = bookings.map((booking) => {
            const customerName = booking.userId?.name || booking.userId?.email?.split('@')[0] || 'Unknown';
            return {
                id: booking._id.toString(),
                bookingId: booking._id.toString(),
                type: 'booking',
                customer: {
                    name: customerName,
                    email: booking.userId?.email || '',
                    phone: booking.userId?.phone || '',
                },
                service: booking.serviceName || 'Service',
                amount: booking.amount || booking.totalAmount || 0,
                refund: {
                    eligible: booking.refund?.eligible || false,
                    amount: booking.refund?.amount || 0,
                    reason: booking.refund?.reason || '',
                    status: booking.refund?.status || 'none',
                    requestedAt: booking.refund?.requestedAt,
                    processedAt: booking.refund?.processedAt,
                },
                cancelledAt: booking.updatedAt,
                createdAt: booking.createdAt,
            };
        });

        // Format order refunds
        const formattedOrders = orders.map((order) => {
            const customerName = order.userId?.name || order.userId?.email?.split('@')[0] || 'Unknown';
            const isProcessed = order.paymentStatus === 'refunded';
            return {
                id: order._id.toString(),
                bookingId: order._id.toString(), // Use same field for consistency
                orderId: order.orderNumber,
                type: 'order',
                customer: {
                    name: customerName,
                    email: order.userId?.email || '',
                    phone: order.userId?.phone || '',
                },
                service: `Order ${order.orderNumber}`,
                amount: order.totalAmount || 0,
                refund: {
                    eligible: true,
                    amount: order.totalAmount || 0,
                    reason: 'Order cancelled',
                    status: isProcessed ? 'processed' : 'pending',
                    requestedAt: order.updatedAt,
                    processedAt: isProcessed ? order.updatedAt : null,
                },
                cancelledAt: order.updatedAt,
                createdAt: order.createdAt,
            };
        });

        // Combine and sort by date
        const allRefunds = [...formattedBookings, ...formattedOrders]
            .sort((a, b) => new Date(b.cancelledAt) - new Date(a.cancelledAt));

        // Apply pagination
        const paginatedRefunds = allRefunds.slice(skip, skip + parseInt(limit));

        res.json({
            success: true,
            data: {
                data: paginatedRefunds,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });
    }

    // Mark a refund as processed
    async markRefunded(req, res) {
        const { id } = req.params;

        // Try to find as booking first
        let booking = await Booking.findById(id);
        if (booking) {
            if (booking.status !== 'cancelled') {
                throw new BadRequestError('Only cancelled bookings can have refunds processed');
            }
            if (!booking.refund?.eligible) {
                throw new BadRequestError('This booking is not eligible for refund');
            }
            if (booking.refund?.status === 'processed') {
                throw new BadRequestError('Refund has already been processed');
            }

            booking.refund.status = 'processed';
            booking.refund.processedAt = new Date();
            booking.paymentStatus = 'refunded';
            await booking.save();

            return res.json({
                success: true,
                data: {
                    id: booking._id.toString(),
                    type: 'booking',
                    message: 'Refund marked as processed',
                    refund: {
                        amount: booking.refund.amount,
                        status: booking.refund.status,
                        processedAt: booking.refund.processedAt,
                    },
                },
            });
        }

        // Try to find as order
        let order = await ProductOrder.findById(id);
        if (order) {
            if (order.status !== 'cancelled') {
                throw new BadRequestError('Only cancelled orders can have refunds processed');
            }
            if (order.paymentStatus === 'refunded') {
                throw new BadRequestError('Refund has already been processed');
            }

            order.paymentStatus = 'refunded';
            await order.save();

            return res.json({
                success: true,
                data: {
                    id: order._id.toString(),
                    type: 'order',
                    message: 'Refund marked as processed',
                    refund: {
                        amount: order.totalAmount,
                        status: 'processed',
                        processedAt: new Date(),
                    },
                },
            });
        }

        throw new NotFoundError('Booking or Order not found');
    }

    // Get refund stats for dashboard
    async getRefundStats(req, res) {
        // Booking stats
        const bookingPendingCount = await Booking.countDocuments({
            status: 'cancelled',
            'refund.status': 'pending',
        });

        const bookingProcessedCount = await Booking.countDocuments({
            status: 'cancelled',
            'refund.status': 'processed',
        });

        const bookingPendingAmount = await Booking.aggregate([
            { $match: { status: 'cancelled', 'refund.status': 'pending' } },
            { $group: { _id: null, total: { $sum: '$refund.amount' } } },
        ]);

        const bookingProcessedAmount = await Booking.aggregate([
            { $match: { status: 'cancelled', 'refund.status': 'processed' } },
            { $group: { _id: null, total: { $sum: '$refund.amount' } } },
        ]);

        // Order stats
        const orderPendingCount = await ProductOrder.countDocuments({
            status: { $in: ['cancelled', 'returned'] },
            paymentStatus: { $in: ['paid', 'pending', 'processing'] },
        });

        const orderProcessedCount = await ProductOrder.countDocuments({
            paymentStatus: 'refunded',
        });

        const orderPendingAmount = await ProductOrder.aggregate([
            { $match: { status: { $in: ['cancelled', 'returned'] }, paymentStatus: { $in: ['paid', 'pending', 'processing'] } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]);

        const orderProcessedAmount = await ProductOrder.aggregate([
            { $match: { paymentStatus: 'refunded' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]);

        res.json({
            success: true,
            data: {
                pending: {
                    count: bookingPendingCount + orderPendingCount,
                    amount: (bookingPendingAmount[0]?.total || 0) + (orderPendingAmount[0]?.total || 0),
                },
                processed: {
                    count: bookingProcessedCount + orderProcessedCount,
                    amount: (bookingProcessedAmount[0]?.total || 0) + (orderProcessedAmount[0]?.total || 0),
                },
            },
        });
    }
}

module.exports = new RefundController();
