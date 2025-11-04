const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [3, 'Name must be at least 3 characters'],
      maxlength: [100, 'Name must not exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [1000, 'Description must not exceed 1000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [1, 'Price must be at least ₹1'],
      max: [1000000, 'Price must not exceed ₹10,00,000'],
    },
    comparePrice: {
      type: Number,
      min: 0,
      default: null,
    },
    stock: {
      type: Number,
      required: [true, 'Stock is required'],
      min: [0, 'Stock cannot be negative'],
      max: [100000, 'Stock must not exceed 1,00,000'],
      default: 0,
    },
    sku: {
      type: String,
      sparse: true,
      trim: true,
    },
    images: {
      type: [String],
      required: [true, 'At least one image is required'],
      validate: {
        validator: (v) => v && v.length >= 1 && v.length <= 5,
        message: 'Must have between 1 and 5 images',
      },
    },
    active: {
      type: Boolean,
      default: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
productSchema.index({ category: 1 });
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ active: 1 });
productSchema.index({ featured: 1 });

module.exports = mongoose.model('Product', productSchema);
