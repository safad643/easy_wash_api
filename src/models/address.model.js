const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: [true, 'Label is required'],
      trim: true,
      maxlength: [50, 'Label must not exceed 50 characters'],
    },
    line1: {
      type: String,
      required: [true, 'Address line 1 is required'],
      trim: true,
      maxlength: [200, 'Address line 1 too long'],
    },
    line2: {
      type: String,
      trim: true,
      maxlength: [200, 'Address line 2 too long'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [100, 'City too long'],
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
      maxlength: [100, 'State too long'],
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true,
      maxlength: [10, 'Pincode too long'],
    },
    landmark: {
      type: String,
      trim: true,
      maxlength: [200, 'Landmark too long'],
    },
    phone: {
      type: String,
      trim: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false, transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    if (ret.user) {
      ret.userId = String(ret.user);
      delete ret.user;
    }
    return ret;
  } } }
);

module.exports = mongoose.model('Address', addressSchema);


