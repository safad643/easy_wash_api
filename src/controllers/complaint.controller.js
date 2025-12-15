const complaintService = require('../services/complaint.service');

/**
 * Customer: Create a complaint
 * POST /api/complaints
 */
const create = async (req, res, next) => {
    try {
        const complaint = await complaintService.createComplaint(req.userId, req.body);
        res.status(201).json({ success: true, data: complaint });
    } catch (err) {
        next(err);
    }
};

/**
 * Customer: Get complaint for a specific order
 * GET /api/complaints/:referenceType/:referenceId
 */
const getByReference = async (req, res, next) => {
    try {
        const { referenceType, referenceId } = req.params;
        const complaint = await complaintService.getComplaintByReference(
            req.userId,
            referenceType,
            referenceId
        );
        res.json({ success: true, data: complaint });
    } catch (err) {
        next(err);
    }
};

/**
 * Customer: Check if can file complaint
 * GET /api/complaints/can-file/:referenceType/:referenceId
 */
const canFileComplaint = async (req, res, next) => {
    try {
        const { referenceType, referenceId } = req.params;
        const result = await complaintService.canFileComplaint(
            req.userId,
            referenceType,
            referenceId
        );
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};

/**
 * Admin: List all complaints
 * GET /api/admin/complaints
 */
const adminList = async (req, res, next) => {
    try {
        const result = await complaintService.listAllComplaints(req.query);
        res.json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
};

/**
 * Admin: Get complaint details
 * GET /api/admin/complaints/:id
 */
const adminDetail = async (req, res, next) => {
    try {
        const complaint = await complaintService.getComplaintById(req.params.id);
        res.json({ success: true, data: complaint });
    } catch (err) {
        next(err);
    }
};

/**
 * Admin: Resolve complaint
 * PATCH /api/admin/complaints/:id/resolve
 */
const adminResolve = async (req, res, next) => {
    try {
        const { status, adminResponse } = req.body;
        const complaint = await complaintService.resolveComplaint(
            req.params.id,
            { status, adminResponse },
            req.userId
        );
        res.json({ success: true, data: complaint });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    create,
    getByReference,
    canFileComplaint,
    adminList,
    adminDetail,
    adminResolve,
};
