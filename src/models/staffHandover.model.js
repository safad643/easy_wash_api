const mongoose = require('mongoose');

/**
 * StaffHandover Model
 * Tracks daily payment handovers from staff to admin.
 * Staff collects cash and UPI payments throughout the day,
 * then hands over the total to admin at end of day.
 */
const staffHandoverSchema = new mongoose.Schema({
    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    // The date of collection (stored as start of day for easier querying)
    date: {
        type: Date,
        required: true,
        index: true,
    },
    // Amount collected in cash
    cashAmount: {
        type: Number,
        default: 0,
        min: 0,
    },
    // Amount collected via UPI/GPay (to staff's personal account)
    onlineAmount: {
        type: Number,
        default: 0,
        min: 0,
    },
    // Total amount (cash + online)
    totalAmount: {
        type: Number,
        default: 0,
        min: 0,
    },
    // Booking IDs included in this handover
    bookingIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
    }],
    // Handover status
    status: {
        type: String,
        enum: ['pending', 'received'],
        default: 'pending',
        index: true,
    },
    // When admin marked as received
    receivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    receivedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

// Compound index for efficient queries
staffHandoverSchema.index({ staffId: 1, date: 1 }, { unique: true });
staffHandoverSchema.index({ staffId: 1, status: 1 });

module.exports = mongoose.model('StaffHandover', staffHandoverSchema);
