const Booking = require('../models/booking.model');
const { NotFoundError, BadRequestError } = require('../utils/errors');

class RefundController {
    // List bookings with refund requests
    async getRefunds(req, res) {
        const {
            status = 'pending',
            fromDate,
            toDate,
            page = 1,
            limit = 10,
        } = req.query || {};

        const query = {
            status: 'cancelled',
            'refund.status': { $in: status === 'all' ? ['pending', 'processed'] : [status] },
        };

        // Filter by date range
        if (fromDate || toDate) {
            query['refund.requestedAt'] = {};
            if (fromDate) {
                query['refund.requestedAt'].$gte = new Date(fromDate);
            }
            if (toDate) {
                const toDateEnd = new Date(toDate);
                toDateEnd.setHours(23, 59, 59, 999);
                query['refund.requestedAt'].$lte = toDateEnd;
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Booking.countDocuments(query);

        const bookings = await Booking.find(query)
            .populate({
                path: 'userId',
                select: 'name email phone',
                options: { lean: true }
            })
            .sort({ 'refund.requestedAt': -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean()
            .exec();

        const formattedRefunds = bookings.map((booking) => {
            const customerName = booking.userId?.name || booking.userId?.email?.split('@')[0] || 'Unknown';

            return {
                id: booking._id.toString(),
                bookingId: booking._id.toString(),
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

        res.json({
            success: true,
            data: {
                data: formattedRefunds,
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

        const booking = await Booking.findById(id);
        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

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

        res.json({
            success: true,
            data: {
                id: booking._id.toString(),
                message: 'Refund marked as processed',
                refund: {
                    amount: booking.refund.amount,
                    status: booking.refund.status,
                    processedAt: booking.refund.processedAt,
                },
            },
        });
    }

    // Get refund stats for dashboard
    async getRefundStats(req, res) {
        const pendingCount = await Booking.countDocuments({
            status: 'cancelled',
            'refund.status': 'pending',
        });

        const processedCount = await Booking.countDocuments({
            status: 'cancelled',
            'refund.status': 'processed',
        });

        const pendingAmount = await Booking.aggregate([
            { $match: { status: 'cancelled', 'refund.status': 'pending' } },
            { $group: { _id: null, total: { $sum: '$refund.amount' } } },
        ]);

        const processedAmount = await Booking.aggregate([
            { $match: { status: 'cancelled', 'refund.status': 'processed' } },
            { $group: { _id: null, total: { $sum: '$refund.amount' } } },
        ]);

        res.json({
            success: true,
            data: {
                pending: {
                    count: pendingCount,
                    amount: pendingAmount[0]?.total || 0,
                },
                processed: {
                    count: processedCount,
                    amount: processedAmount[0]?.total || 0,
                },
            },
        });
    }
}

module.exports = new RefundController();
