const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  phone: {
    type: String,
    sparse: true
  },
  email: {
    type: String,
    sparse: true,
    lowercase: true,
    trim: true
  },
  otp: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  purpose: {
    type: String,
    enum: ['verification', 'password-reset'],
    default: 'verification'
  }
}, {
  timestamps: true
});

// Validate that at least one of phone or email is provided
otpSchema.pre('validate', function(next) {
  if (!this.phone && !this.email) {
    next(new Error('Either phone or email must be provided'));
  } else {
    next();
  }
});

// Index for faster lookups
otpSchema.index({ phone: 1 });
otpSchema.index({ email: 1 });

// TTL index - auto-delete expired OTPs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OTP', otpSchema);
