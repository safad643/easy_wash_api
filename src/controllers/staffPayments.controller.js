const staffPaymentsService = require('../services/staffPayments.service');

class StaffPaymentsController {
    /**
     * Get collections for a specific date
     * GET /staff/payments?date=YYYY-MM-DD&filter=all|cash|online
     */
    async getCollections(req, res, next) {
        try {
            const staffId = req.userId;
            const { date, filter = 'all' } = req.query;

            // Default to today if no date provided
            const targetDate = date || new Date().toISOString().split('T')[0];

            const result = await staffPaymentsService.getCollectionsByDate(
                staffId,
                targetDate,
                filter
            );

            res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get collection summary for past days
     * GET /staff/payments/summary?days=7
     */
    async getSummary(req, res, next) {
        try {
            const staffId = req.userId;
            const { days = 7 } = req.query;

            const result = await staffPaymentsService.getCollectionSummary(
                staffId,
                parseInt(days)
            );

            res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new StaffPaymentsController();
