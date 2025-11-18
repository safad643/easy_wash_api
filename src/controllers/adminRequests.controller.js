const Slot = require('../models/slot.model');
const Booking = require('../models/booking.model');
const User = require('../models/user.model');
const Vehicle = require('../models/vehicle.model');
const Address = require('../models/address.model');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const toMinutes = (time) => {
  if (!time || typeof time !== 'string') return 0;
  const [hours, minutes = '00'] = time.split(':').map((part) => parseInt(part, 10));
  return hours * 60 + minutes;
};

const generateHourlyTimes = (startTime, endTime) => {
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);

  if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) {
    throw new BadRequestError('Invalid time format. Use HH:MM (24h) format.');
  }

  if (startMinutes >= endMinutes) {
    throw new BadRequestError('End time must be greater than start time');
  }

  const times = [];
  for (let minutes = startMinutes; minutes < endMinutes; minutes += 60) {
    const hours = Math.floor(minutes / 60)
      .toString()
      .padStart(2, '0');
    const mins = (minutes % 60)
      .toString()
      .padStart(2, '0');
    times.push(`${hours}:${mins}`);
  }
  return times;
};

// Helper function to get customer name with fallback
function getCustomerName(userId) {
  if (!userId) return 'Unknown';
  if (userId.name) return userId.name;
  if (userId.email) return userId.email.split('@')[0]; // Use email username as fallback
  if (userId.phone) return userId.phone; // Use phone as last resort
  return 'Unknown';
}

// Helper function to format booking details
function formatBookingDetail(booking) {
  const customerName = getCustomerName(booking.userId);
  
  // Format scheduled date and time for display
  const scheduledDateTime = new Date(booking.scheduledAt);
  const scheduledDate = scheduledDateTime.toISOString().split('T')[0];
  const scheduledTime = scheduledDateTime.toTimeString().slice(0, 5);
  
  // Format date for display (e.g., "Monday, Nov 10, 2025")
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
  const formattedDate = scheduledDateTime.toLocaleDateString('en-US', dateOptions);

  return {
    id: booking._id.toString(),
    bookingNumber: booking._id.toString(),
    customerDetails: {
      name: customerName,
      email: booking.userId?.email || '',
      phone: booking.userId?.phone || '',
      avatar: booking.userId?.avatar,
    },
    service: booking.serviceName || 'Service',
    serviceId: booking.serviceId,
    scheduledDate: scheduledDate,
    scheduledTime: scheduledTime,
    scheduledDateTime: booking.scheduledAt.toISOString(),
    scheduledDateFormatted: formattedDate,
    status: booking.status,
    assignedStaff: booking.staffId
      ? {
          id: booking.staffId._id.toString(),
          name: booking.staffId.name,
          phone: booking.staffId.phone,
          email: booking.staffId.email,
          status: booking.staffId.status,
          skills: booking.staffId.skills || [],
        }
      : null,
    assignedStaffId: booking.staffId?._id?.toString() || null,
    amount: booking.amount,
    totalAmount: booking.totalAmount,
    advanceAmount: booking.advanceAmount,
    paymentStatus: booking.paymentStatus,
    paymentType: booking.paymentType,
    vehicleDetails: booking.vehicleId
      ? {
          brand: booking.vehicleId.brand,
          model: booking.vehicleId.model,
          number: booking.vehicleId.plateNumber,
          type: booking.vehicleId.type,
          year: booking.vehicleId.year,
        }
      : null,
    address: booking.address ? {
      label: booking.address.label,
      line1: booking.address.line1,
      line2: booking.address.line2,
      city: booking.address.city,
      state: booking.address.state,
      pincode: booking.address.pincode,
      landmark: booking.address.landmark,
      phone: booking.address.phone,
      fullAddress: `${booking.address.line1}${booking.address.line2 ? ', ' + booking.address.line2 : ''}, ${booking.address.city}, ${booking.address.state} - ${booking.address.pincode}`.replace(/,\s*,/g, ',').trim(),
    } : null,
    coordinates: booking.coordinates,
    addOns: booking.addOns || [],
    feedback: booking.feedback,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}

class AdminRequestsController {
  async getSlots(req, res) {
    const { date } = req.query;
    if (!date) {
      throw new BadRequestError('date query parameter is required');
    }

    const slots = await Slot.find({ date })
      .sort({ time: 1 })
      .lean()
      .exec();

    // Format slots to include booked field for frontend compatibility
    const formattedSlots = slots.map((slot) => ({
      ...slot,
      booked: slot.status === 'booked' || slot.bookingId !== null,
    }));

    res.json({ success: true, data: { slots: formattedSlots } });
  }

  async createSlots(req, res) {
    const { date, startTime, endTime, capacity } = req.body || {};
    if (!date) throw new BadRequestError('date is required');
    if (!startTime || !endTime) {
      throw new BadRequestError('startTime and endTime are required');
    }

    const hourlyTimes = generateHourlyTimes(startTime, endTime);
    if (!hourlyTimes.length) {
      throw new BadRequestError('No slots generated for the provided time range');
    }

    const operations = hourlyTimes.map((time) => ({
      updateOne: {
        filter: { date, time },
        update: {
          $set: {
            date,
            time,
            status: 'unavailable',
          },
          $setOnInsert: {
            bookingId: null,
          },
        },
        upsert: true,
      },
    }));

    await Slot.bulkWrite(operations, { ordered: false });

    const slots = await Slot.find({ date })
      .sort({ time: 1 })
      .lean()
      .exec();

    // Format slots to include booked field for frontend compatibility
    const formattedSlots = slots.map((slot) => ({
      ...slot,
      booked: slot.status === 'booked' || slot.bookingId !== null,
    }));

    res.status(201).json({ success: true, data: { slots: formattedSlots } });
  }

  async updateSlot(req, res) {
    const { slotId } = req.params;
    const { status } = req.body || {};

    if (!slotId) {
      throw new BadRequestError('slotId is required');
    }

    if (!status) {
      throw new BadRequestError('status is required');
    }

    // First, fetch the slot to check if it's booked
    const existingSlot = await Slot.findById(slotId);
    if (!existingSlot) {
      throw new NotFoundError('Slot not found');
    }

    // Prevent status changes if slot is booked
    if (existingSlot.status === 'booked') {
      throw new BadRequestError('Cannot change status of a booked slot');
    }

    if (!['available', 'unavailable'].includes(status)) {
      throw new BadRequestError('Invalid status. Must be "available" or "unavailable"');
    }

    const slot = await Slot.findByIdAndUpdate(slotId, { status }, { new: true });
    if (!slot) {
      throw new NotFoundError('Slot not found');
    }

    // Convert to plain object and format slot to include booked field for frontend compatibility
    const slotObj = slot.toObject ? slot.toObject() : slot;
    const formattedSlot = {
      ...slotObj,
      booked: slotObj.status === 'booked' || slotObj.bookingId !== null,
    };

    res.json({ success: true, data: formattedSlot });
  }

  async updateSlotsStatus(req, res) {
    const { date, status } = req.body || {};
    if (!date) throw new BadRequestError('date is required');
    if (!status || !['available', 'unavailable'].includes(status)) {
      throw new BadRequestError('Valid status is required');
    }

    // Only update slots that are not already booked
    await Slot.updateMany({ date, status: { $ne: 'booked' } }, { status });

    const slots = await Slot.find({ date })
      .sort({ time: 1 })
      .lean()
      .exec();

    // Format slots to include booked field for frontend compatibility
    const formattedSlots = slots.map((slot) => ({
      ...slot,
      booked: slot.status === 'booked' || slot.bookingId !== null,
    }));

    res.json({ success: true, data: { slots: formattedSlots } });
  }

  // Admin booking management endpoints
  async getAllBookings(req, res) {
    const {
      status,
      staffId,
      search,
      fromDate,
      toDate,
      page = 1,
      limit = 10,
    } = req.query || {};

    const query = {};

    // Filter by status
    if (status) {
      if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
        throw new BadRequestError('Invalid status');
      }
      query.status = status;
    }

    // Filter by staff
    if (staffId) {
      query.staffId = staffId;
    }

    // Search by booking ID or service name
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
        select: 'name email phone',
        // Don't fail if user is deleted - just return null
        options: { lean: true }
      })
      .populate({
        path: 'staffId',
        select: 'name phone',
        options: { lean: true }
      })
      .populate({
        path: 'vehicleId',
        select: 'brand model plateNumber year',
        options: { lean: true }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean()
      .exec();

    // Format bookings for response
    const formattedBookings = bookings.map((booking) => {
      // Better fallback for customer name - use email or phone if name is not available
      let customerName = 'Unknown';
      if (booking.userId) {
        if (booking.userId.name) {
          customerName = booking.userId.name;
        } else if (booking.userId.email) {
          customerName = booking.userId.email.split('@')[0]; // Use email username as fallback
        } else if (booking.userId.phone) {
          customerName = booking.userId.phone; // Use phone as last resort
        }
      }

      // Format scheduled date and time for display
      const scheduledDateTime = new Date(booking.scheduledAt);
      const scheduledDate = scheduledDateTime.toISOString().split('T')[0];
      const scheduledTime = scheduledDateTime.toTimeString().slice(0, 5);
      
      // Format date for display (e.g., "Monday, Nov 10, 2025")
      const dateOptions = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
      const formattedDate = scheduledDateTime.toLocaleDateString('en-US', dateOptions);
      
      return {
        id: booking._id.toString(),
        bookingNumber: booking._id.toString(), // Use MongoDB _id as booking reference
        customer: customerName,
        customerId: booking.userId?._id?.toString(),
        customerEmail: booking.userId?.email,
        customerPhone: booking.userId?.phone,
        service: booking.serviceName || 'Service',
        serviceId: booking.serviceId,
        scheduledDate: scheduledDate,
        scheduledTime: scheduledTime,
        scheduledDateTime: booking.scheduledAt.toISOString(), // Full ISO string for frontend
        scheduledDateFormatted: formattedDate, // Formatted date string for display
        status: booking.status,
        assignedStaff: booking.staffId?.name || null,
        assignedStaffId: booking.staffId?._id?.toString() || null,
        amount: booking.amount,
        totalAmount: booking.totalAmount,
        advanceAmount: booking.advanceAmount,
        paymentStatus: booking.paymentStatus,
        paymentType: booking.paymentType,
        vehicle: booking.vehicleId
          ? {
              brand: booking.vehicleId.brand,
              model: booking.vehicleId.model,
              plateNumber: booking.vehicleId.plateNumber,
              year: booking.vehicleId.year,
            }
          : null,
        address: booking.address ? {
          label: booking.address.label,
          line1: booking.address.line1,
          line2: booking.address.line2,
          city: booking.address.city,
          state: booking.address.state,
          pincode: booking.address.pincode,
          landmark: booking.address.landmark,
          phone: booking.address.phone,
          fullAddress: `${booking.address.line1}${booking.address.line2 ? ', ' + booking.address.line2 : ''}, ${booking.address.city}, ${booking.address.state} - ${booking.address.pincode}`.replace(/,\s*,/g, ',').trim(),
        } : null,
        coordinates: booking.coordinates,
        createdAt: booking.createdAt.toISOString(),
      };
    });

    res.json({
      success: true,
      data: {
        data: formattedBookings,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  }

  async getBookingDetail(req, res) {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate({
        path: 'userId',
        select: 'name email phone avatar',
        options: { lean: true }
      })
      .populate({
        path: 'staffId',
        select: 'name phone email status skills',
        options: { lean: true }
      })
      .populate('vehicleId')
      .lean()
      .exec();

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Format booking detail using helper function
    const formattedBooking = formatBookingDetail(booking);

    res.json({ success: true, data: formattedBooking });
  }

  async assignStaff(req, res) {
    const { id } = req.params;
    const { staffId } = req.body || {};

    if (!staffId) {
      throw new BadRequestError('staffId is required');
    }

    // Verify booking exists
    const booking = await Booking.findById(id);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Verify staff exists and is active
    const staff = await User.findOne({ _id: staffId, role: 'staff' });
    if (!staff) {
      throw new NotFoundError('Staff member not found');
    }
    if (staff.status !== 'active') {
      throw new BadRequestError('Cannot assign inactive staff member');
    }

    // Update booking with staff assignment
    booking.staffId = staffId;
    if (booking.status === 'pending') {
      booking.status = 'confirmed';
    }
    await booking.save();

    // Populate and return updated booking
    const updatedBooking = await Booking.findById(id)
      .populate({
        path: 'userId',
        select: 'name email phone avatar',
        options: { lean: true }
      })
      .populate({
        path: 'staffId',
        select: 'name phone email status skills',
        options: { lean: true }
      })
      .populate('vehicleId')
      .lean()
      .exec();

    const formattedBooking = formatBookingDetail(updatedBooking);

    res.json({ success: true, data: formattedBooking });
  }

  async updateBookingStatus(req, res) {
    const { id } = req.params;
    const { status, note } = req.body || {};

    if (!status) {
      throw new BadRequestError('status is required');
    }

    if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      throw new BadRequestError('Invalid status');
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    booking.status = status;
    await booking.save();

    // Populate and return updated booking
    const updatedBooking = await Booking.findById(id)
      .populate({
        path: 'userId',
        select: 'name email phone avatar',
        options: { lean: true }
      })
      .populate({
        path: 'staffId',
        select: 'name phone email status skills',
        options: { lean: true }
      })
      .populate('vehicleId')
      .lean()
      .exec();

    const formattedBooking = formatBookingDetail(updatedBooking);

    res.json({ success: true, data: formattedBooking });
  }

  async removeStaffAssignment(req, res) {
    const { id } = req.params;

    const booking = await Booking.findById(id);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    booking.staffId = null;
    if (booking.status === 'confirmed') {
      booking.status = 'pending';
    }
    await booking.save();

    // Populate and return updated booking
    const updatedBooking = await Booking.findById(id)
      .populate({
        path: 'userId',
        select: 'name email phone avatar',
        options: { lean: true }
      })
      .populate({
        path: 'staffId',
        select: 'name phone email status skills',
        options: { lean: true }
      })
      .populate('vehicleId')
      .lean()
      .exec();

    const formattedBooking = formatBookingDetail(updatedBooking);

    res.json({ success: true, data: formattedBooking });
  }
}

module.exports = new AdminRequestsController();


