const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    landmark: { type: String, trim: true },
    phone: { type: String, trim: true },
  },
  { _id: false }
);

const itemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    productImage: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const productOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'processing',
        'confirmed',
        'packed',
        'shipped',
        'out-for-delivery',
        'delivered',
        'cancelled',
        'returned',
      ],
      default: 'processing',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'processing', 'paid', 'failed', 'refunded', 'partial'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      default: 'online',
    },
    items: {
      type: [itemSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    deliveryAddress: {
      type: addressSchema,
      required: true,
    },
    trackingNumber: {
      type: String,
      trim: true,
    },
    notes: [
      {
        note: { type: String, trim: true },
        addedBy: { type: String, enum: ['customer', 'staff', 'admin'], default: 'customer' },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String, trim: true, maxlength: 1000 },
      createdAt: { type: Date },
    },
    meta: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
  }
);

productOrderSchema.pre('validate', function (next) {
  if (!this.orderNumber) {
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.orderNumber = `ORD-${Date.now().toString().slice(-6)}-${randomSuffix}`;
  }
  if (!this.items || this.items.length === 0) {
    this.items = [];
  }
  this.subtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
  this.totalAmount = this.subtotal - (this.discount || 0) + (this.tax || 0) + (this.shippingFee || 0);
  next();
});

productOrderSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ProductOrder', productOrderSchema);

