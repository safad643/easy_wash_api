const reportService = require('../services/report.service');

class ReportController {
    async getOrdersReport(req, res, next) {
        try {
            const data = await reportService.getOrdersReport(req.query);
            res.json({ success: true, data });
        } catch (err) {
            next(err);
        }
    }

    async getBookingsReport(req, res, next) {
        try {
            const data = await reportService.getBookingsReport(req.query);
            res.json({ success: true, data });
        } catch (err) {
            next(err);
        }
    }

    async getOrdersSummary(req, res, next) {
        try {
            const data = await reportService.getReportSummary(req.query, 'orders');
            res.json({ success: true, data });
        } catch (err) {
            next(err);
        }
    }

    async getBookingsSummary(req, res, next) {
        try {
            const data = await reportService.getReportSummary(req.query, 'bookings');
            res.json({ success: true, data });
        } catch (err) {
            next(err);
        }
    }

    async exportOrdersPdf(req, res, next) {
        try {
            await reportService.generateOrdersPdf(req.query, res);
        } catch (err) {
            next(err);
        }
    }

    async exportBookingsPdf(req, res, next) {
        try {
            await reportService.generateBookingsPdf(req.query, res);
        } catch (err) {
            next(err);
        }
    }

    async exportOrdersCsv(req, res, next) {
        try {
            const csv = await reportService.generateOrdersCsv(req.query);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=orders-report-${Date.now()}.csv`);
            res.send(csv);
        } catch (err) {
            next(err);
        }
    }

    async exportBookingsCsv(req, res, next) {
        try {
            const csv = await reportService.generateBookingsCsv(req.query);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=bookings-report-${Date.now()}.csv`);
            res.send(csv);
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new ReportController();
