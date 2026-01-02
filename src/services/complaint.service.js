const Complaint = require('../models/complaint.model');
const Booking = require('../models/booking.model');
const ProductOrder = require('../models/productOrder.model');
const User = require('../models/user.model');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');
const notificationService = require('./notification.service');

// Complaint eligibility window in hours
const COMPLAINT_WINDOW_HOURS = 48;

class ComplaintService {
    /**
     * Create a complaint for a booking or product order
     * Validates: ownership, completion status, 48-hour window, no duplicates
     */
    async createComplaint(userId, { referenceType, referenceId, category, description }) {
        // Validate required fields
        if (!referenceType || !referenceId || !category || !description) {
            throw new BadRequestError('Missing required fields: referenceType, referenceId, category, description');
        }

        if (!['booking', 'productOrder'].includes(referenceType)) {
            throw new BadRequestError('Invalid referenceType. Must be "booking" or "productOrder"');
        }

        // Check if complaint already exists for this order
        const existingComplaint = await Complaint.findOne({ referenceType, referenceId });
        if (existingComplaint) {
            throw new BadRequestError('A complaint has already been filed for this order');
        }

        // Get the order/booking and validate
        let order;
        let completedAt;

        if (referenceType === 'booking') {
            order = await Booking.findOne({ _id: referenceId, userId });
            if (!order) {
                throw new NotFoundError('Booking not found');
            }
            if (order.status !== 'completed') {
                throw new BadRequestError('Complaints can only be filed for completed bookings');
            }
            completedAt = order.updatedAt; // Use updatedAt as completion time
        } else {
            order = await ProductOrder.findOne({ _id: referenceId, userId });
            if (!order) {
                throw new NotFoundError('Order not found');
            }
            if (order.status !== 'delivered') {
                throw new BadRequestError('Complaints can only be filed for delivered orders');
            }
            completedAt = order.updatedAt; // Use updatedAt as delivery time
        }

        // Check 48-hour window
        const now = new Date();
        const hoursSinceCompletion = (now - completedAt) / (1000 * 60 * 60);
        if (hoursSinceCompletion > COMPLAINT_WINDOW_HOURS) {
            throw new BadRequestError(`Complaints can only be filed within ${COMPLAINT_WINDOW_HOURS} hours of order completion`);
        }

        // Create the complaint
        const complaint = await Complaint.create({
            userId,
            referenceType,
            referenceId,
            category,
            description: description.trim(),
            status: 'pending',
        });

        return this._formatComplaint(complaint);
    }

    /**
     * Get complaint for a specific order (customer view)
     * Hides "ignored" status - shows as "pending" instead
     */
    async getComplaintByReference(userId, referenceType, referenceId) {
        const complaint = await Complaint.findOne({ referenceType, referenceId, userId });

        if (!complaint) {
            return null;
        }

        return this._formatComplaintForCustomer(complaint);
    }

    /**
     * Check if user can file a complaint for an order
     */
    async canFileComplaint(userId, referenceType, referenceId) {
        // Check if complaint already exists
        const existingComplaint = await Complaint.findOne({ referenceType, referenceId });
        if (existingComplaint) {
            return { canFile: false, reason: 'complaint_exists' };
        }

        // Get the order/booking
        let order;
        let completedAt;

        if (referenceType === 'booking') {
            order = await Booking.findOne({ _id: referenceId, userId });
            if (!order) {
                return { canFile: false, reason: 'not_found' };
            }
            if (order.status !== 'completed') {
                return { canFile: false, reason: 'not_completed' };
            }
            completedAt = order.updatedAt;
        } else {
            order = await ProductOrder.findOne({ _id: referenceId, userId });
            if (!order) {
                return { canFile: false, reason: 'not_found' };
            }
            if (order.status !== 'delivered') {
                return { canFile: false, reason: 'not_delivered' };
            }
            completedAt = order.updatedAt;
        }

        // Check 48-hour window
        const now = new Date();
        const hoursSinceCompletion = (now - completedAt) / (1000 * 60 * 60);
        if (hoursSinceCompletion > COMPLAINT_WINDOW_HOURS) {
            return { canFile: false, reason: 'window_expired', hoursAgo: Math.floor(hoursSinceCompletion) };
        }

        return { canFile: true, hoursRemaining: Math.ceil(COMPLAINT_WINDOW_HOURS - hoursSinceCompletion) };
    }

    /**
     * Admin: List all complaints with filters and pagination
     */
    async listAllComplaints(filters = {}) {
        const {
            status,
            category,
            referenceType,
            search,
            page = 1,
            limit = 20,
        } = filters;

        const query = {};

        if (status) {
            query.status = status;
        }
        if (category) {
            query.category = category;
        }
        if (referenceType) {
            query.referenceType = referenceType;
        }

        // Build aggregation pipeline for search and population
        const pipeline = [
            { $match: query },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        ];

        // Add search filter
        if (search) {
            pipeline.push({
                $match: {
                    $or: [
                        { 'user.name': { $regex: search, $options: 'i' } },
                        { 'user.email': { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } },
                    ],
                },
            });
        }

        // Add sorting
        pipeline.push({ $sort: { createdAt: -1 } });

        // Get total count
        const countPipeline = [...pipeline, { $count: 'total' }];
        const countResult = await Complaint.aggregate(countPipeline);
        const total = countResult[0]?.total || 0;

        // Add pagination
        const skip = (page - 1) * limit;
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: parseInt(limit) });

        const complaints = await Complaint.aggregate(pipeline);

        // Enrich with order details
        const enrichedComplaints = await Promise.all(
            complaints.map(async (complaint) => {
                let orderDetails = null;

                if (complaint.referenceType === 'booking') {
                    const booking = await Booking.findById(complaint.referenceId).lean();
                    if (booking) {
                        orderDetails = {
                            orderNumber: booking._id.toString().slice(-6).toUpperCase(),
                            serviceName: booking.serviceName,
                            amount: booking.amount || booking.totalAmount,
                            scheduledAt: booking.scheduledAt,
                        };
                    }
                } else {
                    const order = await ProductOrder.findById(complaint.referenceId).lean();
                    if (order) {
                        orderDetails = {
                            orderNumber: order.orderNumber,
                            itemCount: order.items?.length || 0,
                            amount: order.totalAmount,
                        };
                    }
                }

                return {
                    id: complaint._id.toString(),
                    userId: complaint.userId?.toString(),
                    customerName: complaint.user?.name || 'Unknown',
                    customerEmail: complaint.user?.email,
                    customerPhone: complaint.user?.phone,
                    referenceType: complaint.referenceType,
                    referenceId: complaint.referenceId?.toString(),
                    orderDetails,
                    category: complaint.category,
                    description: complaint.description,
                    status: complaint.status,
                    adminResponse: complaint.adminResponse,
                    resolvedAt: complaint.resolvedAt,
                    createdAt: complaint.createdAt,
                    updatedAt: complaint.updatedAt,
                };
            })
        );

        return {
            data: enrichedComplaints,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Admin: Get complaint by ID with full details
     */
    async getComplaintById(complaintId) {
        const complaint = await Complaint.findById(complaintId)
            .populate('userId', 'name email phone')
            .populate('resolvedBy', 'name email')
            .lean();

        if (!complaint) {
            throw new NotFoundError('Complaint not found');
        }

        // Get order details
        let orderDetails = null;

        if (complaint.referenceType === 'booking') {
            const booking = await Booking.findById(complaint.referenceId).lean();
            if (booking) {
                orderDetails = {
                    type: 'booking',
                    id: booking._id.toString(),
                    orderNumber: booking._id.toString().slice(-6).toUpperCase(),
                    serviceName: booking.serviceName,
                    amount: booking.amount || booking.totalAmount,
                    scheduledAt: booking.scheduledAt,
                    status: booking.status,
                    vehicle: booking.vehicle,
                    address: booking.address,
                };
            }
        } else {
            const order = await ProductOrder.findById(complaint.referenceId).lean();
            if (order) {
                orderDetails = {
                    type: 'productOrder',
                    id: order._id.toString(),
                    orderNumber: order.orderNumber,
                    items: order.items,
                    amount: order.totalAmount,
                    status: order.status,
                    deliveryAddress: order.deliveryAddress,
                };
            }
        }

        return {
            id: complaint._id.toString(),
            userId: complaint.userId?._id?.toString(),
            customerName: complaint.userId?.name || 'Unknown',
            customerEmail: complaint.userId?.email,
            customerPhone: complaint.userId?.phone,
            referenceType: complaint.referenceType,
            referenceId: complaint.referenceId?.toString(),
            orderDetails,
            category: complaint.category,
            description: complaint.description,
            status: complaint.status,
            adminResponse: complaint.adminResponse,
            resolvedAt: complaint.resolvedAt,
            resolvedBy: complaint.resolvedBy ? {
                id: complaint.resolvedBy._id?.toString(),
                name: complaint.resolvedBy.name,
                email: complaint.resolvedBy.email,
            } : null,
            createdAt: complaint.createdAt,
            updatedAt: complaint.updatedAt,
        };
    }

    /**
     * Admin: Resolve a complaint
     */
    async resolveComplaint(complaintId, { status, adminResponse }, adminId) {
        const validStatuses = ['in_progress', 'resolved_call', 'resolved_message', 'invalid', 'ignored'];
        if (!validStatuses.includes(status)) {
            throw new BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        const complaint = await Complaint.findById(complaintId);
        if (!complaint) {
            throw new NotFoundError('Complaint not found');
        }

        const isResolved = ['resolved_call', 'resolved_message', 'invalid', 'ignored'].includes(status);

        complaint.status = status;
        if (adminResponse) {
            complaint.adminResponse = adminResponse.trim();
        }
        if (isResolved) {
            complaint.resolvedAt = new Date();
            complaint.resolvedBy = adminId;
        }

        await complaint.save();

        // Send notification to customer about complaint status
        const statusMessages = {
            'in_progress': 'We are looking into your complaint.',
            'resolved_call': 'Your complaint has been resolved.',
            'resolved_message': 'Your complaint has been resolved.',
            'invalid': 'Your complaint has been reviewed and closed.'
        };

        if (statusMessages[status] && status !== 'ignored') {
            try {
                await notificationService.createNotification(complaint.userId, {
                    title: isResolved ? 'Complaint Resolved' : 'Complaint Update',
                    message: statusMessages[status],
                    type: 'system',
                    actionUrl: complaint.referenceType === 'booking'
                        ? `/orders/services/${complaint.referenceId}`
                        : `/orders/products/${complaint.referenceId}`
                });
            } catch (err) {
                console.error('Failed to send complaint notification:', err.message);
            }
        }

        return this._formatComplaint(complaint);
    }

    /**
     * Format complaint for API response
     */
    _formatComplaint(complaint) {
        return {
            id: complaint._id.toString(),
            userId: complaint.userId?.toString(),
            referenceType: complaint.referenceType,
            referenceId: complaint.referenceId?.toString(),
            category: complaint.category,
            description: complaint.description,
            status: complaint.status,
            adminResponse: complaint.adminResponse,
            resolvedAt: complaint.resolvedAt,
            createdAt: complaint.createdAt,
            updatedAt: complaint.updatedAt,
        };
    }

    /**
     * Format complaint for customer view
     * Hides "ignored" status and shows simplified status labels
     */
    _formatComplaintForCustomer(complaint) {
        // Map internal statuses to customer-friendly statuses
        let customerStatus;
        let statusLabel;

        switch (complaint.status) {
            case 'pending':
                customerStatus = 'pending';
                statusLabel = 'Pending Review';
                break;
            case 'in_progress':
                customerStatus = 'in_progress';
                statusLabel = 'Under Investigation';
                break;
            case 'resolved_call':
                customerStatus = 'resolved';
                statusLabel = 'Resolved';
                break;
            case 'resolved_message':
                customerStatus = 'resolved';
                statusLabel = 'Resolved';
                break;
            case 'invalid':
                customerStatus = 'resolved';
                statusLabel = 'Reviewed & Closed';
                break;
            case 'ignored':
                // Hide ignored status from customer
                customerStatus = 'in_progress';
                statusLabel = 'Under Review';
                break;
            default:
                customerStatus = complaint.status;
                statusLabel = complaint.status;
        }

        // Only show admin response for non-ignored complaints
        const showResponse = complaint.status !== 'ignored' && complaint.adminResponse;

        return {
            id: complaint._id.toString(),
            category: complaint.category,
            description: complaint.description,
            status: customerStatus,
            statusLabel,
            adminResponse: showResponse ? complaint.adminResponse : null,
            createdAt: complaint.createdAt,
            resolvedAt: ['resolved_call', 'resolved_message', 'invalid'].includes(complaint.status)
                ? complaint.resolvedAt
                : null,
        };
    }
}

module.exports = new ComplaintService();
