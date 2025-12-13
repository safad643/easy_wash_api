const ProductOrder = require('../models/productOrder.model');
const Booking = require('../models/booking.model');
const User = require('../models/user.model');

class DashboardService {
    /**
     * Get dashboard statistics with change percentages
     * @param {string} dateRange - 'today', 'week', 'month', 'year', 'all'
     */
    async getStats(dateRange = 'month') {
        const now = new Date();
        let currentStart, previousStart, previousEnd;

        switch (dateRange) {
            case 'today':
                currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                previousStart = new Date(currentStart);
                previousStart.setDate(previousStart.getDate() - 1);
                previousEnd = new Date(currentStart);
                break;
            case 'week':
                currentStart = new Date(now);
                currentStart.setDate(now.getDate() - 7);
                previousStart = new Date(currentStart);
                previousStart.setDate(previousStart.getDate() - 7);
                previousEnd = new Date(currentStart);
                break;
            case 'month':
                currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
                previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                previousEnd = new Date(currentStart);
                break;
            case 'year':
                currentStart = new Date(now.getFullYear(), 0, 1);
                previousStart = new Date(now.getFullYear() - 1, 0, 1);
                previousEnd = new Date(currentStart);
                break;
            case 'all':
            default:
                // For 'all', compare last 30 days to previous 30 days
                currentStart = new Date(now);
                currentStart.setDate(now.getDate() - 30);
                previousStart = new Date(currentStart);
                previousStart.setDate(previousStart.getDate() - 30);
                previousEnd = new Date(currentStart);
                break;
        }

        // Current period stats
        const [currentOrders, currentBookings, currentCustomers] = await Promise.all([
            ProductOrder.aggregate([
                { $match: { createdAt: { $gte: currentStart } } },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                        revenue: { $sum: '$totalAmount' },
                    },
                },
            ]),
            Booking.aggregate([
                { $match: { createdAt: { $gte: currentStart } } },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                        revenue: { $sum: '$amount' },
                    },
                },
            ]),
            User.countDocuments({ role: 'customer', createdAt: { $gte: currentStart } }),
        ]);

        // Previous period stats for comparison
        const [previousOrders, previousBookings, previousCustomers] = await Promise.all([
            ProductOrder.aggregate([
                { $match: { createdAt: { $gte: previousStart, $lt: previousEnd } } },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                        revenue: { $sum: '$totalAmount' },
                    },
                },
            ]),
            Booking.aggregate([
                { $match: { createdAt: { $gte: previousStart, $lt: previousEnd } } },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                        revenue: { $sum: '$amount' },
                    },
                },
            ]),
            User.countDocuments({ role: 'customer', createdAt: { $gte: previousStart, $lt: previousEnd } }),
        ]);

        // Calculate totals
        const totalOrderRevenue = currentOrders[0]?.revenue || 0;
        const totalBookingRevenue = currentBookings[0]?.revenue || 0;
        const totalRevenue = totalOrderRevenue + totalBookingRevenue;
        const totalOrders = currentOrders[0]?.count || 0;
        const totalBookings = currentBookings[0]?.count || 0;
        const totalCustomers = await User.countDocuments({ role: 'customer' });

        // Previous period totals
        const prevOrderRevenue = previousOrders[0]?.revenue || 0;
        const prevBookingRevenue = previousBookings[0]?.revenue || 0;
        const prevRevenue = prevOrderRevenue + prevBookingRevenue;
        const prevOrders = previousOrders[0]?.count || 0;
        const prevBookings = previousBookings[0]?.count || 0;

        // Calculate change percentages
        const calcChange = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Number((((current - previous) / previous) * 100).toFixed(1));
        };

        return {
            totalRevenue,
            revenueChange: calcChange(totalRevenue, prevRevenue),
            totalOrders,
            ordersChange: calcChange(totalOrders, prevOrders),
            totalBookings,
            bookingsChange: calcChange(totalBookings, prevBookings),
            totalCustomers,
            customersChange: calcChange(currentCustomers, previousCustomers),
        };
    }

    /**
     * Get recent orders
     * @param {number} limit - Number of orders to return
     */
    async getRecentOrders(limit = 10) {
        const orders = await ProductOrder.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('userId', 'name email')
            .lean();

        return orders.map((order) => ({
            id: order.orderNumber || order._id.toString(),
            customer: order.userId?.name || 'Unknown',
            date: order.createdAt.toISOString(),
            amount: order.totalAmount || 0,
            status: order.status,
            paymentStatus: order.paymentStatus,
        }));
    }

    /**
     * Get recent bookings
     * @param {number} limit - Number of bookings to return
     */
    async getRecentBookings(limit = 10) {
        const bookings = await Booking.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('userId', 'name email')
            .lean();

        return bookings.map((booking) => ({
            id: booking._id.toString(),
            customer: booking.userId?.name || 'Unknown',
            service: booking.serviceName || 'Service',
            date: booking.createdAt.toISOString(),
            amount: booking.amount || 0,
            status: booking.status,
        }));
    }

    /**
     * Get order status distribution for pie chart
     */
    async getOrderStatusDistribution() {
        const statusCounts = await ProductOrder.aggregate([
            {
                $group: {
                    _id: '$status',
                    value: { $sum: 1 },
                },
            },
        ]);

        const statusColors = {
            pending: '#F59E0B',
            processing: '#3B82F6',
            confirmed: '#3B82F6',
            packed: '#8B5CF6',
            shipped: '#8B5CF6',
            'out-for-delivery': '#8B5CF6',
            delivered: '#10B981',
            cancelled: '#EF4444',
            returned: '#EF4444',
        };

        const statusNames = {
            pending: 'Pending',
            processing: 'Processing',
            confirmed: 'Confirmed',
            packed: 'Packed',
            shipped: 'Shipped',
            'out-for-delivery': 'Out for Delivery',
            delivered: 'Delivered',
            cancelled: 'Cancelled',
            returned: 'Returned',
        };

        return statusCounts.map((item) => ({
            name: statusNames[item._id] || item._id,
            value: item.value,
            color: statusColors[item._id] || '#6B7280',
        }));
    }

    /**
     * Get booking status distribution for pie chart
     */
    async getBookingStatusDistribution() {
        const statusCounts = await Booking.aggregate([
            {
                $group: {
                    _id: '$status',
                    value: { $sum: 1 },
                },
            },
        ]);

        const statusColors = {
            pending: '#F59E0B',
            confirmed: '#3B82F6',
            cancelled: '#EF4444',
            completed: '#10B981',
            couldnt_reach: '#6B7280',
        };

        const statusNames = {
            pending: 'Pending',
            confirmed: 'Confirmed',
            cancelled: 'Cancelled',
            completed: 'Completed',
            couldnt_reach: "Couldn't Reach",
        };

        return statusCounts.map((item) => ({
            name: statusNames[item._id] || item._id,
            value: item.value,
            color: statusColors[item._id] || '#6B7280',
        }));
    }

    /**
     * Get activity data for charts (orders and bookings over time)
     * @param {string} period - 'today', 'week', 'month', 'year', 'all'
     */
    async getActivityData(period = 'week') {
        const now = new Date();
        let startDate;
        let groupFormat;
        let intervals;
        let intervalType; // 'hour', 'day', 'month'

        switch (period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                groupFormat = '%Y-%m-%d-%H';
                intervals = 24;
                intervalType = 'hour';
                break;
            case 'week':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 6);
                startDate.setHours(0, 0, 0, 0);
                groupFormat = '%Y-%m-%d';
                intervals = 7;
                intervalType = 'day';
                break;
            case 'month':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 29);
                startDate.setHours(0, 0, 0, 0);
                groupFormat = '%Y-%m-%d';
                intervals = 30;
                intervalType = 'day';
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
                groupFormat = '%Y-%m';
                intervals = 12;
                intervalType = 'month';
                break;
            case 'all':
            default:
                // For 'all', show last 12 months
                startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
                groupFormat = '%Y-%m';
                intervals = 12;
                intervalType = 'month';
                break;
        }

        const [orderData, bookingData] = await Promise.all([
            ProductOrder.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                {
                    $group: {
                        _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
                        count: { $sum: 1 },
                    },
                },
            ]),
            Booking.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                {
                    $group: {
                        _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);

        // Create map for quick lookup
        const orderMap = new Map(orderData.map((d) => [d._id, d.count]));
        const bookingMap = new Map(bookingData.map((d) => [d._id, d.count]));

        // Generate data for each interval
        const result = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        for (let i = 0; i < intervals; i++) {
            let key;
            let label;

            if (intervalType === 'hour') {
                const date = new Date(startDate);
                date.setHours(startDate.getHours() + i);
                key = `${date.toISOString().split('T')[0]}-${String(date.getHours()).padStart(2, '0')}`;
                const hour = date.getHours();
                label = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
            } else if (intervalType === 'day') {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                key = date.toISOString().split('T')[0];
                label = period === 'week' ? dayNames[date.getDay()] : `${date.getDate()}/${date.getMonth() + 1}`;
            } else if (intervalType === 'month') {
                const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                label = monthNames[date.getMonth()];
            }

            result.push({
                name: label,
                product: orderMap.get(key) || 0,
                service: bookingMap.get(key) || 0,
            });
        }

        return result;
    }

    /**
     * Get combined dashboard summary
     * @param {string} dateRange - 'today', 'week', 'month', 'year', 'all'
     */
    async getDashboardSummary(dateRange = 'month') {
        const [stats, recentOrders, recentBookings, orderStatusData, bookingStatusData, activityData] =
            await Promise.all([
                this.getStats(dateRange),
                this.getRecentOrders(10),
                this.getRecentBookings(10),
                this.getOrderStatusDistribution(),
                this.getBookingStatusDistribution(),
                this.getActivityData(dateRange),
            ]);

        return {
            stats,
            recentOrders,
            recentBookings,
            orderStatusData,
            bookingStatusData,
            activityData,
        };
    }
}

module.exports = new DashboardService();
