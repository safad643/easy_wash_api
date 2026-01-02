const settingsService = require('../services/settings.service');

// Platform Contact
exports.getPlatformContact = async (req, res, next) => {
    try {
        const contact = await settingsService.getPlatformContact();
        res.json({
            success: true,
            data: contact,
        });
    } catch (error) {
        next(error);
    }
};

exports.updatePlatformContact = async (req, res, next) => {
    try {
        const contact = await settingsService.updatePlatformContact(req.body);
        res.json({
            success: true,
            message: 'Platform contact updated successfully',
            data: contact,
        });
    } catch (error) {
        next(error);
    }
};

// Company Details
exports.getCompanyDetails = async (req, res, next) => {
    try {
        const details = await settingsService.getCompanyDetails();
        res.json({
            success: true,
            data: details,
        });
    } catch (error) {
        next(error);
    }
};

exports.updateCompanyDetails = async (req, res, next) => {
    try {
        const details = await settingsService.updateCompanyDetails(req.body);
        res.json({
            success: true,
            message: 'Company details updated successfully',
            data: details,
        });
    } catch (error) {
        next(error);
    }
};

// Delivery Settings
exports.getDeliverySettings = async (req, res, next) => {
    try {
        const settings = await settingsService.getDeliverySettings();
        res.json({
            success: true,
            data: settings,
        });
    } catch (error) {
        next(error);
    }
};

exports.updateDeliverySettings = async (req, res, next) => {
    try {
        const settings = await settingsService.updateDeliverySettings(req.body);
        res.json({
            success: true,
            message: 'Delivery settings updated successfully',
            data: settings,
        });
    } catch (error) {
        next(error);
    }
};
