const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Auth identifiers
  googleId: {
    type: String,
    sparse: true,
    unique: true
  },
  email: {
    type: String,
    sparse: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    sparse: true,
    unique: true
  },

  // Credentials
  password: {
    type: String,
    select: false,
  },

  // Profile
  name: {
    type: String,
    trim: true,
  },
  avatar: {
    type: String,
    trim: true,
  },

  // Authorization
  role: {
    type: String,
    enum: ['customer', 'staff', 'admin'],
    default: 'customer',
    index: true,
  },

  // Staff-specific fields
  skills: {
    type: [String],
    default: [],
  },
  status: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active',
    index: true,
  },
}, {
  timestamps: true
});

// Index for faster lookups
userSchema.index({ googleId: 1 });
userSchema.index({ phone: 1 });

module.exports = mongoose.model('User', userSchema);
