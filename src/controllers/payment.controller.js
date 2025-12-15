const PaymentService = require('../services/payment.service');

class PaymentController {
    /**
     * GET /api/admin/payments
     * Get paginated list of all payments
     */
    async getPayments(req, res, next) {
        try {
            const result = await PaymentService.getPayments(req.query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/admin/payments/summary
     * Get payment summary statistics
     */
    async getSummary(req, res, next) {
        try {
            const summary = await PaymentService.getSummary(req.query);
            res.json(summary);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/admin/payments/analytics
     * Get payment analytics for charts
     */
    async getAnalytics(req, res, next) {
        try {
            const analytics = await PaymentService.getAnalytics(req.query);
            res.json(analytics);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new PaymentController();
