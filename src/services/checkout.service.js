const crypto = require('crypto');
const Razorpay = require('razorpay');
const config = require('../config/config');
const Booking = require('../models/booking.model');
const Slot = require('../models/slot.model');
const { BadRequestError, NotFoundError } = require('../utils/errors');

class CheckoutService {
  constructor() {
    const { keyId, keySecret } = config.razorpay || {};
    this.razorpay = keyId && keySecret
      ? new Razorpay({ key_id: keyId, key_secret: keySecret })
      : null;
  }

  async createSession(userId, { bookingData, paymentType, amount }) {
    if (!bookingData || !amount) {
      throw new BadRequestError('bookingData and amount are required');
    }

    // Validate booking data
    if (!bookingData.serviceId || !bookingData.vehicleId || !bookingData.scheduledAt) {
      throw new BadRequestError('serviceId, vehicleId, and scheduledAt are required in bookingData');
    }

    // Parse scheduledAt to check slot availability
    let scheduledAt;
    if (bookingData.scheduledAt instanceof Date) {
      scheduledAt = bookingData.scheduledAt;
    } else if (typeof bookingData.scheduledAt === 'string') {
      scheduledAt = new Date(bookingData.scheduledAt);
    } else {
      throw new BadRequestError('Invalid scheduledAt format');
    }

    if (isNaN(scheduledAt.getTime())) {
      throw new BadRequestError('Invalid scheduledAt date');
    }

    // IMPORTANT: Check if slot is still available before processing payment
    const dateKey = scheduledAt.toISOString().slice(0, 10);
    const timeKey = scheduledAt.toTimeString().slice(0, 5);
    const slot = await Slot.findOne({ date: dateKey, time: timeKey });
    
    if (!slot) {
      throw new BadRequestError('Slot not found for the selected date and time');
    }
    
    if (slot.status !== 'available') {
      throw new BadRequestError('This slot has been booked by another user. Please select a different slot.');
    }

    // Calculate pricing to validate amount
    const BookingService = require('./booking.service');
    const preview = await BookingService.previewPricing({
      serviceId: bookingData.serviceId,
      vehicleId: bookingData.vehicleId,
      addOns: bookingData.addOns || [],
      paymentType: paymentType || 'full',
      couponCode: bookingData.couponCode,
    });

    const payableAmount = paymentType === 'advance' && preview.advanceAmount
      ? preview.advanceAmount
      : preview.totalAmount;

    if (amount > payableAmount) {
      throw new BadRequestError('Requested amount exceeds payable amount');
    }

    // Check if Razorpay is configured
    if (!this.razorpay) {
      throw new BadRequestError('Payment gateway is not configured. Please contact support.');
    }

    // Create Razorpay order
    // Generate receipt that's <= 40 characters (Razorpay requirement)
    // Format: RCP + last 8 digits of timestamp + random 4 chars
    const timestampStr = String(Date.now());
    const randomStr = crypto.randomBytes(2).toString('hex');
    const receipt = `RCP${timestampStr.slice(-8)}${randomStr}`;
    
    // Store booking data in notes (will be used to create booking after payment)
    const orderOptions = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: config.razorpay.currency || 'INR',
      receipt: receipt, // Max 15 characters (3 + 8 + 4)
      notes: {
        userId: String(userId),
        paymentType: paymentType || 'full',
        amountPaid: String(amount), // Store the actual amount paid
        // Store booking data as JSON string (Razorpay notes have size limits, so we store essential data)
        bookingData: JSON.stringify({
          serviceId: bookingData.serviceId,
          serviceName: bookingData.serviceName,
          vehicleId: bookingData.vehicleId,
          scheduledAt: scheduledAt.toISOString(),
          addressId: bookingData.addressId,
          address: bookingData.address,
          addOns: bookingData.addOns || [],
          coordinates: bookingData.coordinates,
          couponCode: bookingData.couponCode,
        }),
      },
    };

    try {
      const razorpayOrder = await this.razorpay.orders.create(orderOptions);

      const sessionId = `sess_${crypto.randomBytes(12).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      return {
        sessionId,
        orderId: razorpayOrder.id,
        amount,
        currency: razorpayOrder.currency,
        expiresAt,
      };
    } catch (error) {
      console.error('Razorpay order creation error:', error);
      throw new BadRequestError('Failed to create payment order. Please try again.');
    }
  }

  async verifyPayment(userId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new BadRequestError('All payment verification fields are required');
    }

    if (!this.razorpay) {
      throw new BadRequestError('Payment gateway is not configured');
    }

    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(text)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      throw new BadRequestError('Invalid payment signature');
    }

    // Verify payment with Razorpay API
    try {
      const payment = await this.razorpay.payments.fetch(razorpay_payment_id);
      
      if (payment.status !== 'captured' && payment.status !== 'authorized') {
        throw new BadRequestError('Payment not completed');
      }

      // Get booking data and payment details from Razorpay order notes
      let bookingData = null;
      let amountPaid = null;
      let paymentType = 'full';
      
      try {
        const order = await this.razorpay.orders.fetch(razorpay_order_id);
        if (order.notes) {
          if (order.notes.bookingData) {
            bookingData = JSON.parse(order.notes.bookingData);
          }
          if (order.notes.amountPaid) {
            amountPaid = parseFloat(order.notes.amountPaid);
          }
          if (order.notes.paymentType) {
            paymentType = order.notes.paymentType;
          }
        }
      } catch (orderError) {
        console.error('Error fetching order from Razorpay:', orderError);
      }

      if (!bookingData) {
        throw new BadRequestError('Booking data not found in payment order');
      }

      // Create booking using the data from payment notes
      const BookingService = require('./booking.service');
      const booking = await BookingService.createBooking(userId, {
        ...bookingData,
        paymentType: paymentType,
      });

      // IMPORTANT: Update the advanceAmount with the actual amount paid
      // This ensures we save the exact amount that was paid, not just the calculated preview
      if (paymentType === 'advance' && amountPaid) {
        // Save the actual amount paid as advanceAmount
        booking.advanceAmount = amountPaid;
        // Keep amount as totalAmount (don't change it)
        // amount field represents the total service cost
      } else if (paymentType === 'full' && amountPaid) {
        // For full payment, verify amount paid matches totalAmount
        // The amount field should already be set to totalAmount from createBooking
        if (Math.abs(amountPaid - booking.totalAmount) > 0.01) {
          console.warn(`Payment amount mismatch: paid ${amountPaid}, expected ${booking.totalAmount}`);
        }
      }

      // IMPORTANT: Double-check slot availability before marking as paid
      const dateKey = booking.scheduledAt.toISOString().slice(0, 10);
      const timeKey = booking.scheduledAt.toTimeString().slice(0, 5);
      const slot = await Slot.findOne({ date: dateKey, time: timeKey });
      
      if (!slot) {
        throw new BadRequestError('Slot not found for this booking');
      }
      
      if (slot.status !== 'available') {
        throw new BadRequestError('This slot has been booked by another user. Please select a different slot.');
      }

      // Update booking status
      booking.paymentStatus = 'paid';
      // Status remains 'pending' until admin assigns staff, then becomes 'confirmed'
      await booking.save();

      // Mark slot as booked after successful payment
      slot.status = 'booked';
      slot.bookingId = booking._id;
      await slot.save();

      return {
        success: true,
        bookingId: String(booking._id),
        message: 'Payment received. Once slot assigned to a staff we\'ll let you know.',
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
      };
    } catch (error) {
      console.error('Payment verification error:', error);
      throw new BadRequestError('Payment verification failed');
    }
  }

  async handleSuccess(userId, { sessionId, transactionId, paymentMethod, razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    // Support both old format (sessionId + transactionId) and new format (Razorpay verification)
    if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      return await this.verifyPayment(userId, { razorpay_order_id, razorpay_payment_id, razorpay_signature });
    }

    if (!sessionId || !transactionId) {
      throw new BadRequestError('sessionId and transactionId are required');
    }

    // Fallback to old behavior for backward compatibility
    const booking = await Booking.findOne({ userId, paymentStatus: 'pending' })
      .populate('vehicleId')
      .sort({ createdAt: -1 });
    if (!booking) throw new NotFoundError('No pending booking found to mark paid');

    // IMPORTANT: Double-check slot availability before marking as paid
    const dateKey = booking.scheduledAt.toISOString().slice(0, 10);
    const timeKey = booking.scheduledAt.toTimeString().slice(0, 5);
    const slot = await Slot.findOne({ date: dateKey, time: timeKey });
    
    if (!slot) {
      throw new BadRequestError('Slot not found for this booking');
    }
    
    if (slot.status !== 'available') {
      throw new BadRequestError('This slot has been booked by another user. Please select a different slot.');
    }

    booking.paymentStatus = 'paid';
    // Status remains 'pending' until admin assigns staff, then becomes 'confirmed'
    await booking.save();

    // Mark slot as booked after successful payment
    slot.status = 'booked';
    slot.bookingId = booking._id;
    await slot.save();

    return {
      success: true,
      bookingId: String(booking._id),
      message: 'Payment received. Once slot assigned to a staff we\'ll let you know.',
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


