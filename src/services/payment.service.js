const ProductOrder = require('../models/productOrder.model');
const Booking = require('../models/booking.model');

class PaymentService {
    /**
     * Build date filter based on preset or custom range
     */
    buildDateFilter(query) {
        const { preset, startDate, endDate } = query;
        let dateFilter = {};

        if (startDate && endDate) {
            dateFilter = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
                },
            };
        } else if (preset) {
            const now = new Date();
            let start;

            switch (preset) {
                case 'today':
                    start = new Date(now.setHours(0, 0, 0, 0));
                    break;
                case 'week':
                    start = new Date(now);
                    start.setDate(start.getDate() - 7);
                    break;
                case 'month':
                    start = new Date(now);
                    start.setMonth(start.getMonth() - 1);
                    break;
                case 'year':
                    start = new Date(now);
                    start.setFullYear(start.getFullYear() - 1);
                    break;
                case 'all':
                default:
                    return {};
            }

            dateFilter = { createdAt: { $gte: start } };
        }

        return dateFilter;
    }

    /**
     * Get combined payments from orders and bookings
     */
    async getPayments(query = {}) {
        const { page = 1, limit = 20, status, type, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
        const dateFilter = this.buildDateFilter(query);
        const skip = (page - 1) * limit;

        // Build filters
        const orderFilter = { ...dateFilter };
        const bookingFilter = { ...dateFilter };

        if (status) {
            orderFilter.paymentStatus = status;
            bookingFilter.paymentStatus = status;
        }

        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            orderFilter.$or = [
                { orderNumber: searchRegex },
                { 'deliveryAddress.phone': searchRegex },
            ];
            bookingFilter.$or = [
                { serviceName: searchRegex },
                { 'address.phone': searchRegex },
            ];
        }

        // Fetch data in parallel
        const [orders, bookings, orderCount, bookingCount] = await Promise.all([
            type === 'booking' ? [] : ProductOrder.find(orderFilter)
                .populate('userId', 'name email phone')
                .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
                .lean(),
            type === 'order' ? [] : Booking.find(bookingFilter)
                .populate('userId', 'name email phone')
                .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
                .lean(),
            type === 'booking' ? 0 : ProductOrder.countDocuments(orderFilter),
            type === 'order' ? 0 : Booking.countDocuments(bookingFilter),
        ]);

        // Transform to unified format
        const orderPayments = orders.map(order => ({
            id: order._id,
            type: 'order',
            referenceId: order._id,
            referenceNumber: order.orderNumber,
            customerId: order.userId?._id,
            customerName: order.userId?.name || 'Unknown',
            customerPhone: order.userId?.phone || order.deliveryAddress?.phone || '',
            customerEmail: order.userId?.email || '',
            amount: order.totalAmount || 0,
            paymentStatus: order.paymentStatus || 'pending',
            paymentMethod: order.paymentMethod || 'online',
            transactionId: order.meta?.get?.('razorpay_payment_id') || order.meta?.razorpay_payment_id || null,
            razorpayOrderId: order.meta?.get?.('razorpay_order_id') || order.meta?.razorpay_order_id || null,
            createdAt: order.createdAt,
        }));

        const bookingPayments = bookings.map(booking => ({
            id: booking._id,
            type: 'booking',
            referenceId: booking._id,
            referenceNumber: String(booking._id).slice(-8).toUpperCase(),
            customerId: booking.userId?._id,
            customerName: booking.userId?.name || 'Unknown',
            customerPhone: booking.userId?.phone || booking.address?.phone || '',
            customerEmail: booking.userId?.email || '',
            amount: booking.paymentType === 'advance' ? (booking.advanceAmount || 0) : (booking.totalAmount || booking.amount || 0),
            totalAmount: booking.totalAmount || booking.amount || 0,
            paymentStatus: booking.paymentStatus || 'pending',
            paymentMethod: 'online',
            paymentType: booking.paymentType || 'full',
            transactionId: booking.razorpayPaymentId || null,
            razorpayOrderId: booking.razorpayOrderId || null,
            serviceName: booking.serviceName,
            createdAt: booking.createdAt,
        }));

        // Combine and sort
        let allPayments = [...orderPayments, ...bookingPayments];
        allPayments.sort((a, b) => {
            const aVal = a[sortBy] || a.createdAt;
            const bVal = b[sortBy] || b.createdAt;
            return sortOrder === 'desc' ? new Date(bVal) - new Date(aVal) : new Date(aVal) - new Date(bVal);
        });

        // Paginate
        const total = orderCount + bookingCount;
        const paginatedPayments = allPayments.slice(skip, skip + parseInt(limit));

        return {
            payments: paginatedPayments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get payment summary statistics
     */
    async getSummary(query = {}) {
        const dateFilter = this.buildDateFilter(query);

        const [orderStats, bookingStats] = await Promise.all([
            ProductOrder.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: null,
                        totalCount: { $sum: 1 },
                        totalRevenue: {
                            $sum: {
                                $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalAmount', 0],
                            },
                        },
                        paidCount: {
                            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] },
                        },
                        pendingCount: {
                            $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] },
                        },
                        refundedCount: {
                            $sum: { $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, 1, 0] },
                        },
                        refundedAmount: {
                            $sum: {
                                $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, '$totalAmount', 0],
                            },
                        },
                    },
                },
            ]),
            Booking.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: null,
                        totalCount: { $sum: 1 },
                        totalRevenue: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$paymentStatus', 'paid'] },
                                    {
                                        $cond: [
                                            { $eq: ['$paymentType', 'advance'] },
                                            { $ifNull: ['$advanceAmount', 0] },
                                            { $ifNull: ['$totalAmount', '$amount'] },
                                        ],
                                    },
                                    0,
                                ],
                            },
                        },
                        paidCount: {
                            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] },
                        },
                        pendingCount: {
                            $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] },
                        },
                        refundedCount: {
                            $sum: { $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, 1, 0] },
                        },
                        refundedAmount: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$paymentStatus', 'refunded'] },
                                    { $ifNull: ['$totalAmount', '$amount'] },
                                    0,
                                ],
                            },
                        },
                        advancePayments: {
                            $sum: { $cond: [{ $eq: ['$paymentType', 'advance'] }, 1, 0] },
                        },
                        fullPayments: {
                            $sum: { $cond: [{ $eq: ['$paymentType', 'full'] }, 1, 0] },
                        },
                    },
                },
            ]),
        ]);

        const orderData = orderStats[0] || {
            totalCount: 0,
            totalRevenue: 0,
            paidCount: 0,
            pendingCount: 0,
            refundedCount: 0,
            refundedAmount: 0,
        };

        const bookingData = bookingStats[0] || {
            totalCount: 0,
            totalRevenue: 0,
            paidCount: 0,
            pendingCount: 0,
            refundedCount: 0,
            refundedAmount: 0,
            advancePayments: 0,
            fullPayments: 0,
        };

        const totalCount = orderData.totalCount + bookingData.totalCount;
        const totalRevenue = orderData.totalRevenue + bookingData.totalRevenue;
        const paidCount = orderData.paidCount + bookingData.paidCount;

        return {
            totalTransactions: totalCount,
            totalRevenue,
            averageValue: totalCount > 0 ? Math.round(totalRevenue / paidCount) : 0,
            paidCount,
            pendingCount: orderData.pendingCount + bookingData.pendingCount,
            refundedCount: orderData.refundedCount + bookingData.refundedCount,
            refundedAmount: orderData.refundedAmount + bookingData.refundedAmount,
            orderCount: orderData.totalCount,
            bookingCount: bookingData.totalCount,
            advancePayments: bookingData.advancePayments,
            fullPayments: bookingData.fullPayments + orderData.paidCount,
        };
    }

    /**
     * Get payment analytics for charts
     */
    async getAnalytics(query = {}) {
        const { period = 'week' } = query;
        const dateFilter = this.buildDateFilter({ preset: period });

        // Determine grouping based on period
        let groupFormat;
        let labels = [];
        const now = new Date();

        switch (period) {
            case 'today':
                groupFormat = { $hour: '$createdAt' };
                for (let i = 0; i < 24; i++) {
                    labels.push(`${i}:00`);
                }
                break;
            case 'week':
                groupFormat = { $dayOfWeek: '$createdAt' };
                labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                break;
            case 'month':
                groupFormat = { $dayOfMonth: '$createdAt' };
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                for (let i = 1; i <= daysInMonth; i++) {
                    labels.push(String(i));
                }
                break;
            case 'year':
                groupFormat = { $month: '$createdAt' };
                labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                break;
            default:
                groupFormat = { $month: '$createdAt' };
                labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        }

        const [orderRevenue, bookingRevenue, paymentMethods] = await Promise.all([
            ProductOrder.aggregate([
                { $match: { ...dateFilter, paymentStatus: 'paid' } },
                {
                    $group: {
                        _id: groupFormat,
                        revenue: { $sum: '$totalAmount' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
            Booking.aggregate([
                { $match: { ...dateFilter, paymentStatus: 'paid' } },
                {
                    $group: {
                        _id: groupFormat,
                        revenue: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$paymentType', 'advance'] },
                                    { $ifNull: ['$advanceAmount', 0] },
                                    { $ifNull: ['$totalAmount', '$amount'] },
                                ],
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
            // Payment method distribution
            ProductOrder.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: '$paymentMethod',
                        count: { $sum: 1 },
                        amount: { $sum: '$totalAmount' },
                    },
                },
            ]),
        ]);

        // Merge order and booking revenue data
        const revenueMap = new Map();
        orderRevenue.forEach(item => {
            const key = item._id;
            revenueMap.set(key, {
                orders: item.revenue,
                bookings: 0,
                orderCount: item.count,
                bookingCount: 0,
            });
        });
        bookingRevenue.forEach(item => {
            const key = item._id;
            if (revenueMap.has(key)) {
                const existing = revenueMap.get(key);
                existing.bookings = item.revenue;
                existing.bookingCount = item.count;
            } else {
                revenueMap.set(key, {
                    orders: 0,
                    bookings: item.revenue,
                    orderCount: 0,
                    bookingCount: item.count,
                });
            }
        });

        // Build chart data
        const revenueData = labels.map((label, index) => {
            let key;
            if (period === 'today') {
                key = index;
            } else if (period === 'week') {
                key = index + 1; // MongoDB dayOfWeek is 1-indexed (Sunday = 1)
            } else if (period === 'month') {
                key = index + 1;
            } else {
                key = index + 1; // MongoDB month is 1-indexed
            }
            const data = revenueMap.get(key) || { orders: 0, bookings: 0, orderCount: 0, bookingCount: 0 };
            return {
                label,
                orders: data.orders,
                bookings: data.bookings,
                total: data.orders + data.bookings,
            };
        });

        // Payment method breakdown
        const methodBreakdown = paymentMethods.map(item => ({
            method: item._id || 'online',
            count: item.count,
            amount: item.amount,
        }));

        return {
            revenueData,
            paymentMethods: methodBreakdown,
            period,
        };
    }
}

module.exports = new PaymentService();
