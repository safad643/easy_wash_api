const mongoose = require('mongoose');

const posterSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Poster title is required'],
            trim: true,
            minlength: [3, 'Title must be at least 3 characters'],
            maxlength: [100, 'Title must not exceed 100 characters'],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, 'Description must not exceed 500 characters'],
            default: '',
        },
        image: {
            type: String,
            required: [true, 'Poster image is required'],
        },
        endDate: {
            type: Date,
            required: [true, 'End date is required'],
        },
        headingColor: {
            type: String,
            trim: true,
            default: '#ffffff',
        },
        descriptionColor: {
            type: String,
            trim: true,
            default: '#ffffff',
        },
        showButton: {
            type: Boolean,
            default: false,
        },
        buttonText: {
            type: String,
            trim: true,
            maxlength: [50, 'Button text must not exceed 50 characters'],
            default: '',
        },
        buttonLink: {
            type: String,
            trim: true,
            default: '',
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        displayOrder: {
            type: Number,
            default: 0,
            min: [0, 'Display order must be 0 or greater'],
            max: [100, 'Display order must not exceed 100'],
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for faster queries
posterSchema.index({ isActive: 1, endDate: 1 });
posterSchema.index({ displayOrder: 1 });

module.exports = mongoose.model('Poster', posterSchema);
