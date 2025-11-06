const checkoutService = require('../services/checkout.service');
const { BadRequestError } = require('../utils/errors');

const createSession = async (req, res, next) => {
  const { bookingId, paymentType, amount } = req.body;
  if (!bookingId || !amount) {
    throw new BadRequestError('bookingId and amount are required');
  }
  const session = await checkoutService.createSession(req.userId, { bookingId, paymentType, amount });
  res.json({ success: true, data: session });
};

const paymentSuccess = async (req, res, next) => {
  const { sessionId, transactionId, paymentMethod } = req.body;
  const result = await checkoutService.handleSuccess(req.userId, { sessionId, transactionId, paymentMethod });
  res.json({ success: true, data: { success: result.success, bookingId: result.bookingId, message: result.message } });
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
};


