const Booking = require('../models/booking.model');
const Product = require('../models/product.model');
const { BadRequestError, NotFoundError } = require('../utils/errors');

function generateBookingNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const ms = String(now.getTime()).slice(-5);
  return `BK${yyyy}${mm}${dd}${ms}`;
}

function parseSchedule({ scheduledAt, scheduledDate, scheduledTime }) {
  if (scheduledAt) {
    const dt = new Date(scheduledAt);
    if (isNaN(dt.getTime())) throw new BadRequestError('Invalid scheduledAt');
    return dt;
  }
  if (scheduledDate && scheduledTime) {
    const [h, m] = String(scheduledTime).split(':');
    const dt = new Date(scheduledDate);
    if (isNaN(dt.getTime())) throw new BadRequestError('Invalid scheduledDate');
    dt.setHours(Number(h), Number(m), 0, 0);
    return dt;
  }
  throw new BadRequestError('Scheduling information is required');
}

class BookingService {
  async previewPricing({ serviceId, addOns = [], paymentType = 'full', couponCode }) {
    let servicePrice = 0;
    // Best-effort: try to fetch from products as service catalog
    if (serviceId) {
      const product = await Product.findById(serviceId).lean().exec();
      if (product) servicePrice = product.price || 0;
    }
    if (!servicePrice) servicePrice = 500; // fallback base price

    const addOnsTotal = 0; // placeholder until add-ons are modeled
    const discount = 0; // placeholder until coupons are modeled
    const subTotal = servicePrice + addOnsTotal - discount;
    const taxAmount = Math.round(subTotal * 0.0); // add tax if needed
    const totalAmount = subTotal + taxAmount;
    const advanceAmount = paymentType === 'advance' ? Math.round(totalAmount * 0.2) : undefined;

    return {
      servicePrice,
      addOnsTotal,
      discount,
      taxAmount,
      totalAmount,
      ...(advanceAmount !== undefined ? { advanceAmount } : {}),
      ...(couponCode ? { couponApplied: { code: couponCode, discount } } : {}),
    };
  }

  async getAvailableSlots({ serviceId, date }) {
    if (!serviceId) throw new BadRequestError('serviceId is required');
    if (!date) throw new BadRequestError('date is required');

    const day = new Date(date);
    if (isNaN(day.getTime())) throw new BadRequestError('Invalid date');

    // Business hours 09:00 - 17:30, 30-min intervals
    const slots = [];
    const start = new Date(day);
    start.setHours(9, 0, 0, 0);
    const end = new Date(day);
    end.setHours(17, 30, 0, 0);

    // Fetch existing bookings for that day to mark unavailable times
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await Booking.find({
      serviceId,
      status: { $in: ['pending', 'confirmed'] },
      scheduledAt: { $gte: dayStart, $lte: dayEnd },
    }).select('scheduledAt').lean().exec();

    const bookedTimes = new Set(
      existing.map(b => new Date(b.scheduledAt).toTimeString().slice(0,5))
    );

    for (let t = new Date(start); t <= end; t = new Date(t.getTime() + 30 * 60000)) {
      const label = t.toTimeString().slice(0,5);
      slots.push({ startTime: label, endTime: label, isAvailable: !bookedTimes.has(label) });
    }

    return { date: day.toISOString().slice(0,10), slots };
  }

  async createBooking(userId, input) {
    const scheduledAt = parseSchedule(input);

    const preview = await this.previewPricing({
      serviceId: input.serviceId,
      addOns: input.addOns,
      paymentType: input.paymentType,
      couponCode: input.couponCode,
    });

    const booking = await Booking.create({
      userId,
      serviceId: input.serviceId,
      serviceName: input.serviceName,
      vehicleId: input.vehicleId,
      addressId: input.addressId,
      scheduledAt,
      addOns: input.addOns || [],
      paymentType: input.paymentType || 'full',
      notes: input.notes,
      status: 'pending',
      paymentStatus: 'pending',
      amount: preview.totalAmount,
      totalAmount: preview.totalAmount,
      advanceAmount: preview.advanceAmount,
      bookingNumber: generateBookingNumber(),
    });

    return booking;
  }

  async listBookings(userId, filters = {}) {
    const { status, fromDate, toDate, page = 1, limit = 10 } = filters;
    const query = { userId };
    if (status) query.status = status;
    if (fromDate || toDate) {
      query.scheduledAt = {};
      if (fromDate) query.scheduledAt.$gte = new Date(fromDate);
      if (toDate) query.scheduledAt.$lte = new Date(toDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Booking.countDocuments(query);
    const data = await Booking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    return {
      data,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    };
  }

  async getBooking(userId, id) {
    const booking = await Booking.findOne({ _id: id, userId });
    if (!booking) throw new NotFoundError('Booking not found');
    return booking;
  }

  async cancelBooking(userId, id) {
    const booking = await Booking.findOne({ _id: id, userId });
    if (!booking) throw new NotFoundError('Booking not found');
    if (booking.status === 'cancelled') return booking;
    if (booking.status === 'completed') throw new BadRequestError('Completed bookings cannot be cancelled');

    booking.status = 'cancelled';
    await booking.save();
    return { message: 'Booking cancelled successfully' };
  }

  async submitFeedback(userId, id, { rating, comment }) {
    const booking = await Booking.findOne({ _id: id, userId });
    if (!booking) throw new NotFoundError('Booking not found');

    if (!rating || rating < 1 || rating > 5) {
      throw new BadRequestError('Rating must be between 1 and 5');
    }

    booking.feedback = {
      rating,
      comment: comment || '',
      createdAt: new Date(),
    };

    await booking.save();
    return { message: 'Feedback submitted successfully' };
  }
}

module.exports = new BookingService();


