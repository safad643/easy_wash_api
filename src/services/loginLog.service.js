const LoginLog = require('../models/loginLog.model');

const getClientIp = (req) => {
  const xff = req.headers['x-forwarded-for'];
  if (xff && typeof xff === 'string') {
    return xff.split(',')[0].trim();
  }
  return (
    req.ip ||
    (req.connection && req.connection.remoteAddress) ||
    (req.socket && req.socket.remoteAddress) ||
    null
  );
};

const logLoginAttempt = async ({ req, identifier, method, user, success, error }) => {
  try {
    await LoginLog.create({
      user: user ? user._id : undefined,
      identifier,
      method,
      success,
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
      errorCode: error && (error.code || error.name),
      errorMessage: error && error.message
    });
  } catch (e) {
    // Avoid breaking auth flow if logging fails
    console.error('Failed to log login attempt', e);
  }
};

module.exports = {
  logLoginAttempt
};

