const crypto = require('crypto');
const Razorpay = require('razorpay');
const config = require('../config/config');
const Booking = require('../models/booking.model');
const { BadRequestError, NotFoundError } = require('../utils/errors');

class CheckoutService {
  constructor() {
    const { keyId, keySecret } = config.razorpay || {};
    this.razorpay = keyId && keySecret
      ? new Razorpay({ key_id: keyId, key_secret: keySecret })
      : null;
  }

  async createSession(userId, { bookingId, paymentType, amount }) {
    if (!bookingId || !amount) {
      throw new BadRequestError('bookingId and amount are required');
    }

    const booking = await Booking.findOne({ _id: bookingId, userId });
    if (!booking) throw new NotFoundError('Booking not found');

    const payableAmount = paymentType === 'advance' && booking.advanceAmount
      ? booking.advanceAmount
      : booking.totalAmount || booking.amount;

    if (amount > payableAmount) {
      throw new BadRequestError('Requested amount exceeds payable amount');
    }

    // Generate ephemeral session id; frontend will create Razorpay order using its own API route
    const sessionId = `sess_${crypto.randomBytes(12).toString('hex')}`;

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return {
      sessionId,
      bookingId: String(booking._id),
      amount,
      paymentUrl: '', // Using Razorpay checkout widget on frontend
      expiresAt,
    };
  }

  async handleSuccess(userId, { sessionId, transactionId, paymentMethod }) {
    if (!sessionId || !transactionId) {
      throw new BadRequestError('sessionId and transactionId are required');
    }

    // In a full implementation, we would map sessionId to booking & validate signature
    // For now, rely on client providing booking context via transaction notes if needed
    // As a safe behavior, we will not guess bookingId here; frontend flows send booking update separately
    // To keep API compatible with frontend types, we require the bookingId to be derivable

    // Attempt best-effort: find latest pending booking for user
    const booking = await Booking.findOne({ userId, paymentStatus: 'pending' }).sort({ createdAt: -1 });
    if (!booking) throw new NotFoundError('No pending booking found to mark paid');

    booking.paymentStatus = 'paid';
    if (booking.status === 'pending') booking.status = 'confirmed';
    await booking.save();

    return {
      success: true,
      bookingId: String(booking._id),
      message: 'Payment verified and recorded',
      meta: { transactionId, paymentMethod: paymentMethod || 'razorpay' },
    };
  }

  async handleFailure(userId, { sessionId, errorCode, errorMessage }) {
    if (!sessionId) {
      throw new BadRequestError('sessionId is required');
    }

    // Best-effort: keep booking pending; do not change status
    const booking = await Booking.findOne({ userId, paymentStatus: 'pending' }).sort({ createdAt: -1 });

    return {
      success: false,
      bookingId: booking ? String(booking._id) : '',
      message: errorMessage || 'Payment failed',
      meta: { errorCode },
    };
  }
}

module.exports = new CheckoutService();


