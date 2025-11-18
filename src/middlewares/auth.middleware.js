const { verifyAccessToken } = require('../utils/jwt.util');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Access token is required');
  }
  
  const token = authHeader.split(' ')[1];
  
  const decoded = verifyAccessToken(token);
  
  req.userId = decoded.userId;
  req.userRole = decoded.role;
  
  next();
};

/**
 * Role-based authorization middleware
 * @param {...string} allowedRoles - One or more roles that are allowed to access the route
 * @returns {Function} Express middleware function
 * 
 * @example
 * // Single role
 * router.post('/', authenticate, authorize('admin'), controller.create);
 * 
 * @example
 * // Multiple roles
 * router.get('/', authenticate, authorize('admin', 'staff'), controller.getAll);
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userRole) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!allowedRoles.includes(req.userRole)) {
      throw new ForbiddenError('You do not have permission to access this resource');
    }

    next();
  };
};

module.exports = { authenticate, authorize };
