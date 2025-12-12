const Booking = require('../models/booking.model');
const User = require('../models/user.model');
const Vehicle = require('../models/vehicle.model');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

class StaffJobService {
  /**
   * Get all jobs assigned to a staff member
   */
  async getAssignedJobs(staffId, filters = {}) {
    const {
      status,
      search,
      fromDate,
      toDate,
      page = 1,
      limit = 10,
    } = filters;

    const query = { staffId };

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Search by customer name, service name, or booking ID
    if (search) {
      const mongoose = require('mongoose');
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchConditions = [
        { serviceName: { $regex: escapedSearch, $options: 'i' } },
      ];

      // If search looks like an ObjectId, also search by _id
      if (mongoose.Types.ObjectId.isValid(search)) {
        searchConditions.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      // Search by customer name (populate userId first, then filter)
      query.$or = searchConditions;
    }

    // Filter by date range
    if (fromDate || toDate) {
      query.scheduledAt = {};
      if (fromDate) {
        query.scheduledAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        const toDateEnd = new Date(toDate);
        toDateEnd.setHours(23, 59, 59, 999);
        query.scheduledAt.$lte = toDateEnd;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Booking.countDocuments(query);

    const bookings = await Booking.find(query)
      .populate({
        path: 'userId',
        select: 'name email phone avatar',
        options: { lean: true }
      })
      .populate({
        path: 'vehicleId',
        select: 'category bodyType',
        options: { lean: true }
      })
      .sort({ scheduledAt: 1 }) // Sort by scheduled time (earliest first)
      .skip(skip)
      .limit(parseInt(limit))
      .lean()
      .exec();

    // Format bookings for staff view
    const formattedJobs = bookings.map((booking) => {
      const scheduledDateTime = new Date(booking.scheduledAt);
      const scheduledDate = scheduledDateTime.toISOString().split('T')[0];
      const scheduledTime = scheduledDateTime.toTimeString().slice(0, 5);

      // Format time for display (12-hour format)
      const [hours, minutes] = scheduledTime.split(':');
      const hour12 = parseInt(hours);
      const ampm = hour12 >= 12 ? 'PM' : 'AM';
      const displayHour = hour12 % 12 || 12;
      const displayTime = `${displayHour}:${minutes} ${ampm}`;

      // Get customer name with fallback
      let customerName = 'Unknown';
      if (booking.userId) {
        if (booking.userId.name) {
          customerName = booking.userId.name;
        } else if (booking.userId.email) {
          customerName = booking.userId.email.split('@')[0];
        } else if (booking.userId.phone) {
          customerName = booking.userId.phone;
        }
      }

      // Format address
      const address = booking.address
        ? `${booking.address.line1}${booking.address.line2 ? ', ' + booking.address.line2 : ''}, ${booking.address.city}, ${booking.address.state} - ${booking.address.pincode}`.replace(/,\s*,/g, ',').trim()
        : 'Address not available';

      return {
        id: booking._id.toString(),
        customer: customerName,
        phone: booking.userId?.phone || '',
        service: booking.serviceName || 'Service',
        time: displayTime,
        datetime: booking.scheduledAt.toISOString(),
        location: address,
        status: booking.status,
        amount: booking.amount || 0,
        totalAmount: booking.totalAmount || booking.amount || 0,
        paymentStatus: booking.paymentStatus,
        paymentType: booking.paymentType,
        vehicleDetails: booking.vehicleId
          ? {
            category: booking.vehicleId.category,
            bodyType: booking.vehicleId.bodyType,
          }
          : null,
        address: booking.address,
        coordinates: booking.coordinates,
        scheduledDate,
        scheduledTime,
      };
    });

    return {
      data: formattedJobs,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    };
  }

  /**
   * Get a specific job detail by ID (only if assigned to the staff member)
   */
  async getJobDetail(staffId, jobId) {
    const booking = await Booking.findById(jobId)
      .populate({
        path: 'userId',
        select: 'name email phone avatar',
        options: { lean: true }
      })
      .populate({
        path: 'vehicleId',
        select: 'category bodyType',
        options: { lean: true }
      })
      .lean()
      .exec();

    if (!booking) {
      throw new NotFoundError('Job not found');
    }

    // Verify the job is assigned to this staff member
    if (!booking.staffId || booking.staffId.toString() !== staffId.toString()) {
      throw new ForbiddenError('You do not have access to this job');
    }

    const scheduledDateTime = new Date(booking.scheduledAt);
    const scheduledDate = scheduledDateTime.toISOString().split('T')[0];
    const scheduledTime = scheduledDateTime.toTimeString().slice(0, 5);

    // Format time for display
    const [hours, minutes] = scheduledTime.split(':');
    const hour12 = parseInt(hours);
    const ampm = hour12 >= 12 ? 'PM' : 'AM';
    const displayHour = hour12 % 12 || 12;
    const displayTime = `${displayHour}:${minutes} ${ampm}`;

    // Get customer name
    let customerName = 'Unknown';
    if (booking.userId) {
      if (booking.userId.name) {
        customerName = booking.userId.name;
      } else if (booking.userId.email) {
        customerName = booking.userId.email.split('@')[0];
      } else if (booking.userId.phone) {
        customerName = booking.userId.phone;
      }
    }

    // Format address
    const address = booking.address
      ? `${booking.address.line1}${booking.address.line2 ? ', ' + booking.address.line2 : ''}, ${booking.address.city}, ${booking.address.state} - ${booking.address.pincode}`.replace(/,\s*,/g, ',').trim()
      : 'Address not available';

    return {
      id: booking._id.toString(),
      customer: {
        name: customerName,
        phone: booking.userId?.phone || '',
        email: booking.userId?.email || '',
      },
      service: booking.serviceName || 'Service',
      datetime: booking.scheduledAt.toISOString(),
      location: address,
      status: booking.status,
      amount: booking.amount || 0,
      totalAmount: booking.totalAmount || booking.amount || 0,
      advanceAmount: booking.advanceAmount || 0,
      paymentStatus: booking.paymentStatus,
      paymentType: booking.paymentType,
      vehicleDetails: booking.vehicleId
        ? {
          category: booking.vehicleId.category,
          bodyType: booking.vehicleId.bodyType,
        }
        : null,
      address: booking.address,
      coordinates: booking.coordinates || null,
      scheduledDate,
      scheduledTime,
      notes: booking.notes || [],
      feedback: booking.feedback,
    };
  }

  /**
   * Mark a job as completed (with payment confirmation)
   */
  async completeJob(staffId, jobId, { paymentReceived, notes }) {
    const booking = await Booking.findById(jobId);

    if (!booking) {
      throw new NotFoundError('Job not found');
    }

    // Verify the job is assigned to this staff member
    if (!booking.staffId || booking.staffId.toString() !== staffId.toString()) {
      throw new ForbiddenError('You do not have access to this job');
    }

    // Check if job is already completed or cancelled
    if (booking.status === 'completed') {
      throw new BadRequestError('Job is already completed');
    }
    if (booking.status === 'cancelled') {
      throw new BadRequestError('Cannot complete a cancelled job');
    }

    // Update booking status
    booking.status = 'completed';

    // Update payment status if payment was received
    if (paymentReceived === true) {
      booking.paymentStatus = 'paid';
    }

    // Add notes if provided
    if (notes) {
      if (!booking.notes) {
        booking.notes = [];
      }
      booking.notes.push({
        note: notes,
        addedBy: 'staff',
        addedAt: new Date(),
      });
    }

    await booking.save();

    // Return updated job detail
    return this.getJobDetail(staffId, jobId);
  }

  /**
   * Mark a job as "couldn't reach" (staff couldn't reach customer location)
   */
  async markCouldntReach(staffId, jobId, { notes }) {
    const booking = await Booking.findById(jobId);

    if (!booking) {
      throw new NotFoundError('Job not found');
    }

    // Verify the job is assigned to this staff member
    if (!booking.staffId || booking.staffId.toString() !== staffId.toString()) {
      throw new ForbiddenError('You do not have access to this job');
    }

    // Check if job is already completed or cancelled
    if (booking.status === 'completed') {
      throw new BadRequestError('Cannot mark completed job as couldn\'t reach');
    }
    if (booking.status === 'cancelled') {
      throw new BadRequestError('Job is already cancelled');
    }

    // Update booking status
    booking.status = 'couldnt_reach';

    // Add notes if provided
    if (notes) {
      if (!booking.notes) {
        booking.notes = [];
      }
      booking.notes.push({
        note: notes || 'Staff member could not reach the customer location',
        addedBy: 'staff',
        addedAt: new Date(),
      });
    }

    await booking.save();

    // Return updated job detail
    return this.getJobDetail(staffId, jobId);
  }

  /**
   * Update job status (generic method for status updates)
   */
  async updateJobStatus(staffId, jobId, { status, notes }) {
    const booking = await Booking.findById(jobId);

    if (!booking) {
      throw new NotFoundError('Job not found');
    }

    // Verify the job is assigned to this staff member
    if (!booking.staffId || booking.staffId.toString() !== staffId.toString()) {
      throw new ForbiddenError('You do not have access to this job');
    }

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'couldnt_reach'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Check if status change is allowed
    if (booking.status === 'completed' && status !== 'completed') {
      throw new BadRequestError('Cannot change status of a completed job');
    }
    if (booking.status === 'cancelled' && status !== 'cancelled') {
      throw new BadRequestError('Cannot change status of a cancelled job');
    }

    // Update booking status
    booking.status = status;

    // Add notes if provided
    if (notes) {
      if (!booking.notes) {
        booking.notes = [];
      }
      booking.notes.push({
        note: notes,
        addedBy: 'staff',
        addedAt: new Date(),
      });
    }

    await booking.save();

    // Return updated job detail
    return this.getJobDetail(staffId, jobId);
  }

  /**
   * Get work history (completed jobs) for a staff member
   */
  async getWorkHistory(staffId, filters = {}) {
    const {
      search,
      fromDate,
      toDate,
    } = filters;

    const query = {
      staffId,
      status: 'completed', // Only completed jobs in history
    };

    // Search by customer name, service name, or booking ID
    if (search) {
      const mongoose = require('mongoose');
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchConditions = [
        { serviceName: { $regex: escapedSearch, $options: 'i' } },
      ];

      if (mongoose.Types.ObjectId.isValid(search)) {
        searchConditions.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      query.$or = searchConditions;
    }

    // Filter by date range
    if (fromDate || toDate) {
      query.scheduledAt = {};
      if (fromDate) {
        query.scheduledAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        const toDateEnd = new Date(toDate);
        toDateEnd.setHours(23, 59, 59, 999);
        query.scheduledAt.$lte = toDateEnd;
      }
    }

    const bookings = await Booking.find(query)
      .populate({
        path: 'userId',
        select: 'name email phone',
        options: { lean: true }
      })
      .populate({
        path: 'vehicleId',
        select: 'category bodyType',
        options: { lean: true }
      })
      .sort({ scheduledAt: -1 }) // Most recent first
      .lean()
      .exec();

    // Format bookings for history view
    return bookings.map((booking) => {
      const scheduledDateTime = new Date(booking.scheduledAt);
      const scheduledDate = scheduledDateTime.toISOString().split('T')[0];
      const scheduledTime = scheduledDateTime.toTimeString().slice(0, 5);

      // Format time for display
      const [hours, minutes] = scheduledTime.split(':');
      const hour12 = parseInt(hours);
      const ampm = hour12 >= 12 ? 'PM' : 'AM';
      const displayHour = hour12 % 12 || 12;
      const displayTime = `${displayHour}:${minutes} ${ampm}`;

      // Get customer name
      let customerName = 'Unknown';
      if (booking.userId) {
        if (booking.userId.name) {
          customerName = booking.userId.name;
        } else if (booking.userId.email) {
          customerName = booking.userId.email.split('@')[0];
        } else if (booking.userId.phone) {
          customerName = booking.userId.phone;
        }
      }

      // Format address
      const address = booking.address
        ? `${booking.address.line1}${booking.address.line2 ? ', ' + booking.address.line2 : ''}, ${booking.address.city}, ${booking.address.state} - ${booking.address.pincode}`.replace(/,\s*,/g, ',').trim()
        : 'Address not available';

      return {
        id: booking._id.toString(),
        customer: customerName,
        service: booking.serviceName || 'Service',
        time: displayTime,
        datetime: booking.scheduledAt.toISOString(),
        location: address,
        status: booking.status,
        amount: booking.amount || 0,
        rating: booking.feedback?.rating || null,
      };
    });
  }
}

module.exports = new StaffJobService();

