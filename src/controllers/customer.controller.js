const customerService = require('../services/customer.service');

class CustomerController {
    async list(req, res, next) {
        try {
            const filters = {
                status: req.query.status,
                search: req.query.search,
                page: req.query.page || 1,
                limit: req.query.limit || 10,
            };

            Object.keys(filters).forEach(
                (key) => filters[key] === undefined && delete filters[key]
            );

            const result = await customerService.getCustomerList(filters);
            res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const customer = await customerService.getCustomerById(id);
            res.json({
                success: true,
                data: customer,
            });
        } catch (error) {
            next(error);
        }
    }

    async updateStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const customer = await customerService.updateCustomerStatus(id, status);
            res.json({
                success: true,
                data: customer,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CustomerController();
