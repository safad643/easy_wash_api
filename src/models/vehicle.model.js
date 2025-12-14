const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    bodyType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_, ret) => {
        ret.id = ret._id;
        delete ret._id;
        if (ret.user) {
          ret.userId = String(ret.user);
          delete ret.user;
        }
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Vehicle', vehicleSchema);


