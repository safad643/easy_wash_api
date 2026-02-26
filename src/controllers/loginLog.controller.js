const LoginLog = require('../models/loginLog.model');
const { BadRequestError } = require('../utils/errors');

const getLoginLogs = async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const query = {};
  if (req.query.method) {
    query.method = req.query.method;
  }
  if (typeof req.query.success !== 'undefined') {
    if (req.query.success !== 'true' && req.query.success !== 'false') {
      throw new BadRequestError('success must be "true" or "false"');
    }
    query.success = req.query.success === 'true';
  }

  if (req.query.from || req.query.to) {
    query.createdAt = {};
    if (req.query.from) {
      query.createdAt.$gte = new Date(req.query.from);
    }
    if (req.query.to) {
      query.createdAt.$lte = new Date(req.query.to);
    }
  }

  const [items, total] = await Promise.all([
    LoginLog.find(query)
      .populate('user', 'name email phone role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    LoginLog.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    }
  });
};

const getGroupedLoginLogs = async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const match = {};
  if (req.query.method) {
    match.method = req.query.method;
  }
  if (typeof req.query.success !== 'undefined') {
    if (req.query.success !== 'true' && req.query.success !== 'false') {
      throw new BadRequestError('success must be "true" or "false"');
    }
    match.success = req.query.success === 'true';
  }

  if (req.query.from || req.query.to) {
    match.createdAt = {};
    if (req.query.from) {
      match.createdAt.$gte = new Date(req.query.from);
    }
    if (req.query.to) {
      match.createdAt.$lte = new Date(req.query.to);
    }
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          identifier: '$identifier',
          method: '$method'
        },
        totalAttempts: { $sum: 1 },
        successCount: {
          $sum: {
            $cond: [{ $eq: ['$success', true] }, 1, 0]
          }
        },
        failureCount: {
          $sum: {
            $cond: [{ $eq: ['$success', false] }, 1, 0]
          }
        },
        lastAttemptAt: { $max: '$createdAt' }
      }
    },
    { $sort: { lastAttemptAt: -1 } },
    { $skip: skip },
    { $limit: limit }
  ];

  const items = await LoginLog.aggregate(pipeline);

  res.json({
    success: true,
    data: {
      items: items.map(item => ({
        identifier: item._id.identifier,
        method: item._id.method,
        totalAttempts: item.totalAttempts,
        successCount: item.successCount,
        failureCount: item.failureCount,
        lastAttemptAt: item.lastAttemptAt
      })),
      pagination: {
        page,
        limit
      }
    }
  });
};

module.exports = {
  getLoginLogs,
  getGroupedLoginLogs
};

