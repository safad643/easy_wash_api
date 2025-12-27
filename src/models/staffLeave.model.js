const mongoose = require('mongoose');

const staffLeaveSchema = new mongoose.Schema({
    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    date: {
        type: Date,
        required: true,
        index: true,
    },
    reason: {
        type: String,
        trim: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});

// Compound unique index: one leave record per staff per date
staffLeaveSchema.index({ staffId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('StaffLeave', staffLeaveSchema);
