const mongoose = require('mongoose');

const loginLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    identifier: {
      type: String,
      index: true
    },
    method: {
      type: String,
      enum: ['credentials', 'google', 'email-otp'],
      required: true,
      index: true
    },
    success: {
      type: Boolean,
      required: true,
      index: true
    },
    ip: {
      type: String
    },
    userAgent: {
      type: String
    },
    errorCode: {
      type: String
    },
    errorMessage: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('LoginLog', loginLogSchema);

