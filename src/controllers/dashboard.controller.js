const dashboardService = require('../services/dashboard.service');

class DashboardController {
    /**
     * GET /api/admin/dashboard/stats
     * Get dashboard statistics
     */
    async getStats(req, res, next) {
        try {
            const { dateRange = 'month' } = req.query;
            const stats = await dashboardService.getStats(dateRange);
            res.json({
                success: true,
                data: stats,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/admin/dashboard/recent-orders
     * Get recent orders (last 10)
     */
    async getRecentOrders(req, res, next) {
        try {
            const limit = parseInt(req.query.limit, 10) || 10;
            const orders = await dashboardService.getRecentOrders(Math.min(limit, 10));
            res.json({
                success: true,
                data: orders,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/admin/dashboard/recent-bookings
     * Get recent bookings (last 10)
     */
    async getRecentBookings(req, res, next) {
        try {
            const limit = parseInt(req.query.limit, 10) || 10;
            const bookings = await dashboardService.getRecentBookings(Math.min(limit, 10));
            res.json({
                success: true,
                data: bookings,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/admin/dashboard/order-status
     * Get order status distribution for pie chart
     */
    async getOrderStatusDistribution(req, res, next) {
        try {
            const data = await dashboardService.getOrderStatusDistribution();
            res.json({
                success: true,
                data,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/admin/dashboard/booking-status
     * Get booking status distribution for pie chart
     */
    async getBookingStatusDistribution(req, res, next) {
        try {
            const data = await dashboardService.getBookingStatusDistribution();
            res.json({
                success: true,
                data,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/admin/dashboard/activity
     * Get activity data for charts
     */
    async getActivityData(req, res, next) {
        try {
            const { period = 'week' } = req.query;
            const data = await dashboardService.getActivityData(period);
            res.json({
                success: true,
                data,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/admin/dashboard/summary
     * Get combined dashboard summary (all data in one request)
     */
    async getSummary(req, res, next) {
        try {
            const { dateRange = 'month' } = req.query;
            const summary = await dashboardService.getDashboardSummary(dateRange);
            res.json({
                success: true,
                data: summary,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new DashboardController();
