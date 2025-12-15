const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    // Reference to the order/booking
    referenceType: {
        type: String,
        enum: ['booking', 'productOrder'],
        required: true,
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    // Complaint details
    category: {
        type: String,
        enum: ['service_quality', 'staff_behavior', 'damage_loss', 'wrong_service', 'overcharged', 'other'],
        required: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000,
    },
    // Resolution tracking
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'resolved_call', 'resolved_message', 'invalid', 'ignored'],
        default: 'pending',
        index: true,
    },
    adminResponse: {
        type: String,
        trim: true,
        maxlength: 1000,
    },
    resolvedAt: {
        type: Date,
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});

// Compound index for checking existing complaints
complaintSchema.index({ referenceType: 1, referenceId: 1 }, { unique: true });
// Index for user's complaints
complaintSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Complaint', complaintSchema);
