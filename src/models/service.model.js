const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      minlength: [3, 'Name must be at least 3 characters'],
      maxlength: [100, 'Name must not exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [500, 'Description must not exceed 500 characters'],
    },
    category: {
      type: String,
      enum: ['bike', 'car'],
      required: [true, 'Category is required'],
      index: true,
    },
    pricing: [
      {
        vehicleType: {
          type: String,
          required: [true, 'Vehicle type is required for pricing'],
          trim: true,
        },
        price: {
          type: Number,
          required: [true, 'Price is required for vehicle type'],
          min: [1, 'Price must be at least ₹1'],
          max: [100000, 'Price must not exceed ₹1,00,000'],
        },
      },
    ],
    duration: {
      type: Number, // minutes
      required: [true, 'Duration is required'],
      min: [5, 'Duration must be at least 5 minutes'],
      max: [480, 'Duration must not exceed 8 hours'],
    },
    // vehicleType removed in favor of per-vehicle pricing
    image: {
      type: String,
      trim: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    totalBookings: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

serviceSchema.index({ name: 'text', description: 'text' });
serviceSchema.index({ 'pricing.vehicleType': 1 });

module.exports = mongoose.model('Service', serviceSchema);



