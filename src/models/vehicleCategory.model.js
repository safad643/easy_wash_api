const mongoose = require('mongoose');

const vehicleCategorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Category name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [50, 'Name must not exceed 50 characters'],
        },
        slug: {
            type: String,
            required: [true, 'Slug is required'],
            trim: true,
            lowercase: true,
            unique: true,
            minlength: [2, 'Slug must be at least 2 characters'],
            maxlength: [50, 'Slug must not exceed 50 characters'],
        },
        icon: {
            type: String,
            trim: true,
            default: '🚗',
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

vehicleCategorySchema.index({ isActive: 1, displayOrder: 1 });

module.exports = mongoose.model('VehicleCategory', vehicleCategorySchema);
