const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
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
  }
}, {
  timestamps: true
});

// Index for faster lookups
userSchema.index({ googleId: 1 });
userSchema.index({ phone: 1 });

module.exports = mongoose.model('User', userSchema);
