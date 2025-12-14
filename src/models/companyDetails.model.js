const mongoose = require('mongoose');

const companyDetailsSchema = new mongoose.Schema({
    companyName: {
        type: String,
        default: 'Eazy Wash Services',
    },
    address: {
        type: String,
        default: '456 Service Road, Sector 5',
    },
    city: {
        type: String,
        default: 'Bengaluru, Karnataka - 560103',
    },
    phone: {
        type: String,
        default: '+91 80 5555 1111',
    },
    email: {
        type: String,
        default: 'billing@eazywash.com',
    },
    gst: {
        type: String,
        default: 'GSTIN29ABCDE1234F1Z5',
    },
    website: {
        type: String,
        default: 'www.eazywash.com',
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('CompanyDetails', companyDetailsSchema);
