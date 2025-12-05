const crypto = require('crypto');
const Razorpay = require('razorpay');
const config = require('../config/config');
const Booking = require('../models/booking.model');
const Slot = require('../models/slot.model');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const ProductOrderService = require('./productOrder.service');

class CheckoutService {
  constructor() {
    const { keyId, keySecret } = config.razorpay || {};
    this.razorpay = keyId && keySecret
      ? new Razorpay({ key_id: keyId, key_secret: keySecret })
      : null;
  }

  async createSession(userId, { bookingData, paymentType, amount, type = 'service', orderData }) {
    if (!amount) {
      throw new BadRequestError('Amount is required');
    }

    if (!this.razorpay) {
      throw new BadRequestError('Payment gateway is not configured. Please contact support.');
    }

    if (type === 'product') {
      return this.createProductOrderSession(userId, { orderData, amount });
    }

    if (!bookingData) {
      throw new BadRequestError('bookingData and amount are required');
    }

    return this.createServiceBookingSession(userId, { bookingData, paymentType, amount });
  }

  async createServiceBookingSession(userId, { bookingData, paymentType, amount }) {
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
        orderType: 'service',
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

  async createProductOrderSession(userId, { orderData, amount }) {
    if (!orderData || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      throw new BadRequestError('Order items are required for product checkout');
    }

    if (!orderData.addressId) {
      throw new BadRequestError('Delivery address is required');
    }

    const preview = await ProductOrderService.previewOrder(userId, {
      ...orderData,
      paymentMethod: 'online',
    });

    const payableAmount = preview.totalAmount;
    if (payableAmount <= 0) {
      throw new BadRequestError('Invalid order total amount');
    }

    if (Math.abs(payableAmount - amount) > 0.01) {
      throw new BadRequestError('Requested amount does not match order total');
    }

    const timestampStr = String(Date.now());
    const randomStr = crypto.randomBytes(2).toString('hex');
    const receipt = `RCP${timestampStr.slice(-8)}${randomStr}`;

    const compactItems = preview.normalizedItems.map((item) => ({
      p: String(item.productId),
      q: item.quantity,
    }));

    const productOrderPayload = {
      items: compactItems,
      addressId: orderData.addressId,
      discount: preview.discount,
      tax: preview.tax,
      shippingFee: preview.shippingFee,
      source: orderData.source || 'cart',
      notes: orderData.notes ? String(orderData.notes).slice(0, 200) : '',
    };

    const orderOptions = {
      amount: Math.round(payableAmount * 100),
      currency: config.razorpay.currency || 'INR',
      receipt,
      notes: {
        userId: String(userId),
        orderType: 'product',
        amountPaid: String(payableAmount),
        productOrder: JSON.stringify(productOrderPayload),
      },
    };

    try {
      const razorpayOrder = await this.razorpay.orders.create(orderOptions);
      const sessionId = `sess_${crypto.randomBytes(12).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      return {
        sessionId,
        orderId: razorpayOrder.id,
        amount: payableAmount,
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

      const order = await this.razorpay.orders.fetch(razorpay_order_id);
      const notes = order?.notes || {};
      const amountPaid = notes.amountPaid ? parseFloat(notes.amountPaid) : null;
      const orderType = notes.orderType || (notes.productOrder ? 'product' : 'service');

      if (orderType === 'product') {
        return await this.completeProductOrderPayment(userId, {
          notes,
          razorpay_order_id,
          razorpay_payment_id,
        });
      }

      const bookingData = notes.bookingData ? JSON.parse(notes.bookingData) : null;
      let paymentType = notes.paymentType || 'full';

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
        type: 'service',
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

  async completeProductOrderPayment(userId, { notes, razorpay_order_id, razorpay_payment_id }) {
    if (!notes || !notes.productOrder) {
      throw new BadRequestError('Product order payload missing in payment notes');
    }

    let payload;
    try {
      payload = JSON.parse(notes.productOrder);
    } catch (error) {
      console.error('Failed to parse product order payload from notes', error);
      throw new BadRequestError('Invalid product order payload');
    }

    if (!payload.addressId) {
      throw new BadRequestError('Delivery address missing in payment payload');
    }

    const items = (payload.items || []).map((item) => ({
      productId: item.productId || item.p,
      quantity: item.quantity || item.q || 1,
    }));

    if (items.length === 0) {
      throw new BadRequestError('No items found in product payment payload');
    }

    const orderInput = {
      items,
      addressId: payload.addressId,
      discount: payload.discount || 0,
      tax: payload.tax || 0,
      shippingFee: payload.shippingFee || 0,
      source: payload.source || 'cart',
      notes: payload.notes,
      paymentMethod: 'online',
    };

    const order = await ProductOrderService.createOrder(userId, orderInput);

    if (!order.meta) {
      order.meta = new Map();
    }
    order.meta.set('razorpay_order_id', razorpay_order_id);
    order.meta.set('razorpay_payment_id', razorpay_payment_id);
    await order.save();

    return {
      success: true,
      type: 'product',
      orderId: String(order._id),
      message: 'Payment received. Your order is now confirmed.',
      paymentId: razorpay_payment_id,
      orderNumber: order.orderNumber,
    };
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
      type: 'service',
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


