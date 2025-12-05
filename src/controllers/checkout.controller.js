const checkoutService = require('../services/checkout.service');
const { BadRequestError } = require('../utils/errors');

const createSession = async (req, res, next) => {
  try {
    const { bookingData, paymentType, amount, type = 'service', orderData } = req.body;
    if ((!bookingData && type === 'service') || (!orderData && type === 'product')) {
      throw new BadRequestError('Invalid checkout payload');
    }
    if (!amount) {
      throw new BadRequestError('Amount is required');
    }
    const session = await checkoutService.createSession(req.userId, {
      bookingData,
      paymentType,
      amount,
      type,
      orderData,
    });
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

const paymentSuccess = async (req, res, next) => {
  try {
    const { sessionId, transactionId, paymentMethod, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const result = await checkoutService.handleSuccess(req.userId, { 
      sessionId, 
      transactionId, 
      paymentMethod,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const result = await checkoutService.verifyPayment(req.userId, { razorpay_order_id, razorpay_payment_id, razorpay_signature });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const paymentFailure = async (req, res, next) => {
  const { sessionId, errorCode, errorMessage } = req.body;
  const result = await checkoutService.handleFailure(req.userId, { sessionId, errorCode, errorMessage });
  res.json({ success: true, data: { success: result.success, bookingId: result.bookingId, message: result.message } });
};

module.exports = {
  createSession,
  paymentSuccess,
  paymentFailure,
  verifyPayment,
};


