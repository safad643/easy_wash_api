const bookingService = require('../services/booking.service');
const PDFDocument = require('pdfkit');

class OrdersController {
  async list(req, res, next) {
    try {
      const data = await bookingService.listBookings(req.userId, req.query || {});
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async detail(req, res, next) {
    try {
      const data = await bookingService.getBooking(req.userId, req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async cancel(req, res, next) {
    try {
      const data = await bookingService.cancelBooking(req.userId, req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async invoice(req, res, next) {
    try {
      const booking = await bookingService.getBooking(req.userId, req.params.id);

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${booking._id}.pdf`);

      doc.pipe(res);

      doc.fontSize(20).text('Invoice', { align: 'center' });
      doc.moveDown();

      doc.fontSize(12).text(`Invoice ID: ${booking.bookingNumber || booking._id}`);
      doc.text(`Date: ${new Date(booking.createdAt).toLocaleString()}`);
      doc.text(`Status: ${booking.status}`);
      doc.moveDown();

      doc.text(`Service: ${booking.serviceName || booking.serviceId}`);
      doc.text(`Scheduled At: ${new Date(booking.scheduledAt).toLocaleString()}`);
      doc.moveDown();

      doc.text(`Amount: ₹${Number(booking.totalAmount || booking.amount || 0).toFixed(2)}`);
      if (booking.advanceAmount) {
        doc.text(`Advance Paid: ₹${Number(booking.advanceAmount).toFixed(2)}`);
      }

      doc.end();
    } catch (err) {
      next(err);
    }
  }

  async feedback(req, res, next) {
    try {
      const { rating, comment } = req.body || {};
      const data = await bookingService.submitFeedback(req.userId, req.params.id, { rating, comment });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new OrdersController();


