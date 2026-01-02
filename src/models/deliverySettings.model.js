const mongoose = require('mongoose');

const deliverySettingsSchema = new mongoose.Schema({
    deliveryFee: {
        type: Number,
        default: 40,
        min: 0,
    },
    freeDeliveryThreshold: {
        type: Number,
        default: 500,
        min: 0,
    },
    isEnabled: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('DeliverySettings', deliverySettingsSchema);
