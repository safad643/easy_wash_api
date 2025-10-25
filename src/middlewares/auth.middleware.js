const { verifyAccessToken } = require('../utils/jwt.util');
const { UnauthorizedError } = require('../utils/errors');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Access token is required');
  }
  
  const token = authHeader.split(' ')[1];
  
  const decoded = verifyAccessToken(token);
  
  req.userId = decoded.userId;
  
  next();
};

module.exports = { authenticate };
