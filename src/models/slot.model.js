const mongoose = require('mongoose');

const SlotSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // ISO date string 'YYYY-MM-DD'
    time: { type: String, required: true }, // '09:00' 24h format preferred
    status: {
      type: String,
      enum: ['available', 'booked', 'unavailable'],
      default: 'unavailable',
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
  },
  { timestamps: true }
);

SlotSchema.index({ date: 1, time: 1 }, { unique: true });
SlotSchema.index({ bookingId: 1 });

module.exports = mongoose.model('Slot', SlotSchema);


