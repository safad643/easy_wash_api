const mongoose = require('mongoose');

const platformContactSchema = new mongoose.Schema({
    phone: {
        type: String,
        default: '+91 88489 19507',
    },
    email: {
        type: String,
        default: 'support@eazywash.com',
    },
    location: {
        type: String,
        default: 'Mumbai, Maharashtra',
    },
    description: {
        type: String,
        default: 'Professional car wash and detailing services delivered right to your doorstep. Experience premium quality with every wash.',
    },
    socialLinks: {
        facebook: { type: String, default: '' },
        instagram: { type: String, default: '' },
        twitter: { type: String, default: '' },
        linkedin: { type: String, default: '' },
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('PlatformContact', platformContactSchema);
