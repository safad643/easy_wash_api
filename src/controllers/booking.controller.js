const bookingService = require('../services/booking.service');

class BookingController {
  async create(req, res, next) {
    try {
      const booking = await bookingService.createBooking(req.userId, req.body);
      res.status(201).json({ success: true, data: booking });
    } catch (err) {
      next(err);
    }
  }

  async preview(req, res, next) {
    try {
      const data = await bookingService.previewPricing(req.body || {});
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async availableDays(req, res, next) {
    try {
      const { serviceId, daysAhead } = req.query;
      const data = await bookingService.getAvailableDays({ 
        serviceId, 
        daysAhead: daysAhead ? parseInt(daysAhead) : undefined 
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async slots(req, res, next) {
    try {
      const { serviceId, date } = req.query;
      const data = await bookingService.getAvailableSlots({ serviceId, date });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

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
}

module.exports = new BookingController();


