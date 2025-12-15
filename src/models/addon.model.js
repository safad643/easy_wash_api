const mongoose = require('mongoose');

const addonSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Add-on name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [100, 'Name must not exceed 100 characters'],
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
            minlength: [5, 'Description must be at least 5 characters'],
            maxlength: [300, 'Description must not exceed 300 characters'],
        },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [1, 'Price must be at least ₹1'],
            max: [50000, 'Price must not exceed ₹50,000'],
        },
        duration: {
            type: Number,
            required: [true, 'Duration is required'],
            min: [1, 'Duration must be at least 1 minute'],
            max: [120, 'Duration must not exceed 120 minutes'],
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        applicableCategories: {
            type: [String],
            enum: ['car', 'bike'],
            default: ['car', 'bike'],
            validate: {
                validator: function (v) {
                    return v && v.length > 0;
                },
                message: 'At least one applicable category is required',
            },
        },
        image: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

// Text search index for name and description
addonSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Addon', addonSchema);
