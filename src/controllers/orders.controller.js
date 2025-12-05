const productOrderService = require('../services/productOrder.service');
const PDFDocument = require('pdfkit');
const { NotFoundError } = require('../utils/errors');

const streamInvoice = (order, res) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const orderId = (order._id || order.id || '').toString();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}.pdf`);

  doc.pipe(res);

  doc.fontSize(20).text('Invoice', { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).text(`Order ID: ${orderId}`);
  doc.text(`Order Number: ${order.orderNumber}`);
  doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
  doc.text(`Status: ${order.status}`);
  doc.text(`Payment Status: ${order.paymentStatus}`);
  doc.moveDown();

  doc.text('Shipping Address:');
  const address = order.deliveryAddress || {};
  doc.text(address.line1 || '');
  if (address.line2) doc.text(address.line2);
  doc.text(`${address.city || ''}, ${address.state || ''} ${address.pincode || ''}`);
  if (address.phone) doc.text(`Phone: ${address.phone}`);
  doc.moveDown();

  doc.text('Items:');
  doc.moveDown(0.5);
  (order.items || []).forEach((item, idx) => {
    doc.text(
      `${idx + 1}. ${item.productName || item.name} x${item.quantity} - ₹${Number(
        item.subtotal || item.unitPrice * item.quantity
      ).toFixed(2)}`
    );
  });
  doc.moveDown();

  doc.text(`Subtotal: ₹${Number(order.subtotal || 0).toFixed(2)}`);
  if (order.discount) {
    doc.text(`Discount: -₹${Number(order.discount).toFixed(2)}`);
  }
  if (order.shippingFee) {
    doc.text(`Shipping: ₹${Number(order.shippingFee).toFixed(2)}`);
  }
  if (order.tax) {
    doc.text(`Tax: ₹${Number(order.tax).toFixed(2)}`);
  }
  doc.moveDown();

  doc.text(`Total Amount: ₹${Number(order.totalAmount || order.subtotal || 0).toFixed(2)}`, {
    align: 'right',
  });

  doc.end();
};

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

  async feedback(req, res, next) {
    try {
      const { rating, comment } = req.body || {};
      const data = await productOrderService.submitFeedback(req.userId, req.params.id, { rating, comment });
      res.json({ success: true, data });
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


