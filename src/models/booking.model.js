const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  serviceId: {
    type: String,
    required: true,
  },
  serviceName: {
    type: String,
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true,
  },
  addressId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address',
    required: true,
  },
  scheduledAt: {
    type: Date,
    required: true,
    index: true,
  },
  addOns: {
    type: [String],
    default: [],
  },
  paymentType: {
    type: String,
    enum: ['full', 'advance'],
    default: 'full',
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending',
    index: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending',
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  totalAmount: {
    type: Number,
    min: 0,
  },
  advanceAmount: {
    type: Number,
    min: 0,
  },
  bookingNumber: {
    type: String,
    unique: true,
    index: true,
  },
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
    createdAt: { type: Date },
  },
}, {
  timestamps: true,
});

bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ scheduledAt: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);


