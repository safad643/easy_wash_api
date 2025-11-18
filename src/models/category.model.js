const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must not exceed 100 characters'],
      unique: true,
    },
    type: {
      type: String,
      required: [true, 'Category type is required'],
      enum: ['product'],
      default: 'product',
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must not exceed 500 characters'],
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

// Indexes
categorySchema.index({ name: 'text', description: 'text' });
categorySchema.index({ type: 1, isActive: 1 });

module.exports = mongoose.model('Category', categorySchema);


