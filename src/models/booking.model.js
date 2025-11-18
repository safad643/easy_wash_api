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
  slotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Slot',
    required: true,
    index: true,
  },
  // Full address object stored directly (not as reference)
  address: {
    label: { type: String, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    landmark: { type: String, trim: true },
    phone: { type: String, trim: true },
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
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'couldnt_reach'],
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
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
    createdAt: { type: Date },
  },
  // Notes added by staff/admin
  notes: [{
    note: { type: String, required: true, trim: true },
    addedBy: { type: String, enum: ['staff', 'admin'], required: true },
    addedAt: { type: Date, default: Date.now },
  }],
  // Location coordinates for service delivery
  coordinates: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  // Staff assignment
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
}, {
  timestamps: true,
});

bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ scheduledAt: 1, status: 1 });
bookingSchema.index({ staffId: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);


