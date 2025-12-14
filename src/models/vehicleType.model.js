const mongoose = require('mongoose');

const vehicleTypeSchema = new mongoose.Schema(
    {
        category: {
            type: String,
            required: [true, 'Category is required'],
            trim: true,
            lowercase: true,
            index: true,
        },
        bodyType: {
            type: String,
            required: [true, 'Body type is required'],
            trim: true,
            lowercase: true,
            minlength: [2, 'Body type must be at least 2 characters'],
            maxlength: [50, 'Body type must not exceed 50 characters'],
        },
        name: {
            type: String,
            required: [true, 'Display name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [50, 'Name must not exceed 50 characters'],
        },
        icon: {
            type: String,
            trim: true,
            default: '',
        },
        displayOrder: {
            type: Number,
            default: 0,
            index: true,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// Unique compound index: (category, bodyType) must be unique
vehicleTypeSchema.index({ category: 1, bodyType: 1 }, { unique: true });

// Index for listing
vehicleTypeSchema.index({ category: 1, isActive: 1, displayOrder: 1 });

module.exports = mongoose.model('VehicleType', vehicleTypeSchema);
