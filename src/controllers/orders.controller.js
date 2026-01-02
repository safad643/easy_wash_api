const productOrderService = require('../services/productOrder.service');
const { streamInvoice } = require('../utils/pdfGenerator');

class OrdersController {
  async create(req, res, next) {
    try {
      const order = await productOrderService.createOrder(req.userId, req.body || {});
      res.status(201).json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const data = await productOrderService.listOrders(req.userId, req.query || {});
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async detail(req, res, next) {
    try {
      const data = await productOrderService.getOrder(req.userId, req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async cancel(req, res, next) {
    try {
      const data = await productOrderService.cancelOrder(req.userId, req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async invoice(req, res, next) {
    try {
      const order = await productOrderService.getOrder(req.userId, req.params.id);
      streamInvoice(order, res);
    } catch (err) {
      next(err);
    }
  }

  async adminList(req, res, next) {
    try {
      const data = await productOrderService.listAllOrders(req.query || {});
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async adminDetail(req, res, next) {
    try {
      const data = await productOrderService.getOrderForAdmin(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async adminUpdateStatus(req, res, next) {
    try {
      const { status, note } = req.body || {};
      const data = await productOrderService.updateOrderStatusAdmin(req.params.id, {
        status,
        note,
        updatedBy: req.userId,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async adminInvoice(req, res, next) {
    try {
      const order = await productOrderService.getOrderDocument(req.params.id);
      if (!order) {
        throw new NotFoundError('Order not found');
      }
      streamInvoice(order, res);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new OrdersController();


