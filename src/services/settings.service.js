const PlatformContact = require('../models/platformContact.model');
const CompanyDetails = require('../models/companyDetails.model');

// Platform Contact (Footer)
exports.getPlatformContact = async () => {
    let contact = await PlatformContact.findOne();
    if (!contact) {
        contact = await PlatformContact.create({});
    }
    return contact;
};

exports.updatePlatformContact = async (data) => {
    const contact = await PlatformContact.findOneAndUpdate(
        {},
        { $set: data },
        { new: true, upsert: true, runValidators: true }
    );
    return contact;
};

// Company Details (Invoice)
exports.getCompanyDetails = async () => {
    let details = await CompanyDetails.findOne();
    if (!details) {
        details = await CompanyDetails.create({});
    }
    return details;
};

exports.updateCompanyDetails = async (data) => {
    const details = await CompanyDetails.findOneAndUpdate(
        {},
        { $set: data },
        { new: true, upsert: true, runValidators: true }
    );
    return details;
};
