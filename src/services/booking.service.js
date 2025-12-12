const Booking = require('../models/booking.model');
const Service = require('../models/service.model');
const Vehicle = require('../models/vehicle.model');
const Slot = require('../models/slot.model');
const { BadRequestError, NotFoundError } = require('../utils/errors');


function parseSchedule({ scheduledAt, scheduledDate, scheduledTime }) {
  if (scheduledAt) {
    const dt = new Date(scheduledAt);
    if (isNaN(dt.getTime())) throw new BadRequestError('Invalid scheduledAt');
    return dt;
  }
  if (scheduledDate && scheduledTime) {
    const [h, m] = String(scheduledTime).split(':');
    const dt = new Date(scheduledDate);
    if (isNaN(dt.getTime())) throw new BadRequestError('Invalid scheduledDate');
    dt.setHours(Number(h), Number(m), 0, 0);
    return dt;
  }
  throw new BadRequestError('Scheduling information is required');
}

class BookingService {
  async previewPricing({ serviceId, vehicleId, addOns = [], paymentType = 'full', couponCode }) {
    if (!serviceId) {
      throw new BadRequestError('serviceId is required for pricing');
    }

    // Fetch the service
    const service = await Service.findById(serviceId).lean().exec();
    if (!service) {
      throw new NotFoundError('Service not found');
    }

    // Get vehicle category and bodyType if vehicleId is provided
    let vehicleCategory = null;
    let vehicleBodyType = null;
    if (vehicleId) {
      const vehicle = await Vehicle.findById(vehicleId).lean().exec();
      if (vehicle) {
        vehicleCategory = vehicle.category || null;
        vehicleBodyType = vehicle.bodyType || null;
      }
    }

    // Find the matching price from service pricing array
    let servicePrice = 0;
    if (service.pricing && service.pricing.length > 0) {
      if (vehicleCategory || vehicleBodyType) {
        // Try to find exact match for bodyType first
        let matchingPricing = null;
        if (vehicleBodyType) {
          matchingPricing = service.pricing.find(
            (p) => p.vehicleType && p.vehicleType.toLowerCase() === vehicleBodyType.toLowerCase()
          );
        }

        // If no bodyType match, try category match
        if (!matchingPricing && vehicleCategory) {
          matchingPricing = service.pricing.find(
            (p) => p.vehicleType && p.vehicleType.toLowerCase() === vehicleCategory.toLowerCase()
          );
        }

        if (matchingPricing) {
          servicePrice = matchingPricing.price || 0;
        } else {
          // Try to find partial match (e.g., "car" matches "sedan car", "bike" matches "scooter")
          const searchTerms = [vehicleCategory, vehicleBodyType].filter(Boolean);
          const partialMatch = service.pricing.find(
            (p) => p.vehicleType && searchTerms.some(term =>
              p.vehicleType.toLowerCase().includes(term.toLowerCase()) ||
              term.toLowerCase().includes(p.vehicleType.toLowerCase())
            )
          );
          if (partialMatch) {
            servicePrice = partialMatch.price || 0;
          } else {
            // Use first available pricing as fallback
            servicePrice = service.pricing[0].price || 0;
          }
        }
      } else {
        // No vehicle type, use first pricing entry
        servicePrice = service.pricing[0].price || 0;
      }
    }

    if (!servicePrice || servicePrice <= 0) {
      throw new BadRequestError('Service pricing not found. Please contact support.');
    }

    const addOnsTotal = 0; // placeholder until add-ons are modeled
    const discount = 0; // placeholder until coupons are modeled
    const subTotal = servicePrice + addOnsTotal - discount;
    const taxAmount = Math.round(subTotal * 0.0); // add tax if needed
    const totalAmount = subTotal + taxAmount;
    const advanceAmount = paymentType === 'advance' ? Math.round(totalAmount * 0.3) : undefined; // Changed to 30% as per frontend

    return {
      servicePrice,
      addOnsTotal,
      discount,
      taxAmount,
      totalAmount,
      ...(advanceAmount !== undefined ? { advanceAmount } : {}),
      ...(couponCode ? { couponApplied: { code: couponCode, discount } } : {}),
    };
  }

  async getAvailableDays({ serviceId, daysAhead = 30 }) {
    if (!serviceId) throw new BadRequestError('serviceId is required');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + daysAhead);

    // Generate date range
    const dateRange = [];
    const currentDate = new Date(today);
    while (currentDate <= endDate) {
      dateRange.push(currentDate.toISOString().slice(0, 10));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Find all dates that have at least one available slot (status='available')
    const availableSlots = await Slot.find({
      date: { $in: dateRange },
      status: 'available',
    })
      .select('date')
      .lean()
      .exec();

    // Get unique dates that have available slots
    const availableDaysSet = new Set(availableSlots.map(slot => slot.date));
    const availableDays = Array.from(availableDaysSet).sort();

    return { availableDays };
  }

  async getAvailableSlots({ serviceId, date }) {
    if (!serviceId) throw new BadRequestError('serviceId is required');
    if (!date) throw new BadRequestError('date is required');

    const day = new Date(date);
    if (isNaN(day.getTime())) throw new BadRequestError('Invalid date');
    const dateKey = day.toISOString().slice(0, 10);

    // Fetch only available slots (status='available') for this date
    const availableSlots = await Slot.find({
      date: dateKey,
      status: 'available',
    })
      .sort({ time: 1 })
      .lean()
      .exec();

    // Fetch existing PAID bookings for that day to mark booked slots
    // Only bookings with paymentStatus='paid' should block slots
    // (Bookings with paymentStatus='pending' haven't completed payment, so slot is still available)
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const existingBookings = await Booking.find({
      serviceId,
      paymentStatus: 'paid', // Only count bookings that have been paid
      status: { $in: ['pending', 'confirmed'] }, // Exclude cancelled/completed
      scheduledAt: { $gte: dayStart, $lte: dayEnd },
    }).select('scheduledAt').lean().exec();

    const bookedTimes = new Set(
      existingBookings.map(b => new Date(b.scheduledAt).toTimeString().slice(0, 5))
    );

    // Filter out slots that are already booked by PAID bookings
    // Map slots to the expected format - only return truly available slots
    const slots = availableSlots
      .filter(slot => !bookedTimes.has(slot.time))
      .map((slot, index, filteredSlots) => {
        // Calculate end time - use next slot's time if available, otherwise add 1 hour (slots are hourly)
        let endTimeStr;
        if (index < filteredSlots.length - 1) {
          // Use next slot's start time as this slot's end time
          endTimeStr = filteredSlots[index + 1].time;
        } else {
          // Last slot - add 1 hour
          const [hours, minutes] = slot.time.split(':').map(Number);
          const endTime = new Date(2000, 0, 1, hours + 1, minutes);
          endTimeStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
        }

        return {
          startTime: slot.time,
          endTime: endTimeStr,
          isAvailable: true, // All slots returned are available
        };
      });

    return { date: dateKey, slots };
  }

  async createBooking(userId, input) {
    const scheduledAt = parseSchedule(input);

    const preview = await this.previewPricing({
      serviceId: input.serviceId,
      vehicleId: input.vehicleId,
      addOns: input.addOns,
      paymentType: input.paymentType,
      couponCode: input.couponCode,
    });

    // Extract date and time from scheduledAt
    const dateKey = scheduledAt.toISOString().slice(0, 10);
    const timeKey = scheduledAt.toTimeString().slice(0, 5); // HH:MM format

    // Check if slot exists and is available
    const slot = await Slot.findOne({ date: dateKey, time: timeKey });
    if (!slot) {
      throw new BadRequestError('Slot not found for the selected date and time');
    }
    if (slot.status !== 'available') {
      throw new BadRequestError('Selected slot is not available');
    }

    // Build full address object from input
    let addressObject = null;
    if (input.address) {
      // If address is provided as an object, use it directly
      if (typeof input.address === 'object') {
        addressObject = {
          label: input.address.label || '',
          line1: input.address.line1 || input.address.addressLine1 || '',
          line2: input.address.line2 || input.address.addressLine2 || '',
          city: input.address.city || '',
          state: input.address.state || '',
          pincode: input.address.pincode || '',
          landmark: input.address.landmark || '',
          phone: input.address.phone || '',
        };
      } else {
        // If address is provided as a string (legacy support), we need at least line1, city, state, pincode
        throw new BadRequestError('Address must be provided as an object with line1, city, state, and pincode');
      }
    } else if (input.addressId) {
      // If addressId is provided, fetch the address and save all fields
      const Address = require('../models/address.model');
      const address = await Address.findById(input.addressId).lean();
      if (!address) {
        throw new BadRequestError('Address not found');
      }
      addressObject = {
        label: address.label || '',
        line1: address.line1 || '',
        line2: address.line2 || '',
        city: address.city || '',
        state: address.state || '',
        pincode: address.pincode || '',
        landmark: address.landmark || '',
        phone: address.phone || '',
      };
    }

    if (!addressObject || !addressObject.line1 || !addressObject.city || !addressObject.state || !addressObject.pincode) {
      throw new BadRequestError('Address is required with line1, city, state, and pincode');
    }

    const booking = await Booking.create({
      userId,
      serviceId: input.serviceId,
      serviceName: input.serviceName,
      vehicleId: input.vehicleId,
      slotId: slot._id,
      address: addressObject,
      scheduledAt,
      addOns: input.addOns || [],
      paymentType: input.paymentType || 'full',
      status: 'pending',
      paymentStatus: 'pending',
      amount: preview.totalAmount,
      totalAmount: preview.totalAmount,
      advanceAmount: preview.advanceAmount,
      // Store coordinates if provided
      coordinates: input.coordinates ? {
        latitude: input.coordinates.latitude,
        longitude: input.coordinates.longitude,
      } : undefined,
    });

    // DO NOT mark slot as booked here - only mark it after successful payment
    // This prevents slots from being locked if payment fails

    return booking;
  }

  async listBookings(userId, filters = {}) {
    const { status, fromDate, toDate, page = 1, limit = 10 } = filters;
    const query = { userId };
    if (status) query.status = status;
    if (fromDate || toDate) {
      query.scheduledAt = {};
      if (fromDate) query.scheduledAt.$gte = new Date(fromDate);
      if (toDate) query.scheduledAt.$lte = new Date(toDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Booking.countDocuments(query);
    const bookings = await Booking.find(query)
      .populate('slotId', 'date time')
      .populate('vehicleId', 'category bodyType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Format bookings with scheduledDate and scheduledTime from slot or scheduledAt
    const data = bookings.map(booking => {
      // Get scheduled date and time from slot if available, otherwise from scheduledAt
      let scheduledDate = null;
      let scheduledTime = null;

      if (booking.slotId && booking.slotId.date && booking.slotId.time) {
        scheduledDate = booking.slotId.date;
        scheduledTime = booking.slotId.time;
      } else if (booking.scheduledAt) {
        const scheduledDateTime = new Date(booking.scheduledAt);
        scheduledDate = scheduledDateTime.toISOString().split('T')[0];
        scheduledTime = scheduledDateTime.toTimeString().slice(0, 5);
      }

      return {
        ...booking,
        scheduledDate,
        scheduledTime,
        vehicleDetails: booking.vehicleId ? {
          category: booking.vehicleId.category,
          bodyType: booking.vehicleId.bodyType,
        } : null,
      };
    });

    return {
      data,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    };
  }

  async getBooking(userId, id) {
    const booking = await Booking.findOne({ _id: id, userId })
      .populate('slotId', 'date time')
      .populate('vehicleId', 'category bodyType')
      .lean();

    if (!booking) throw new NotFoundError('Booking not found');

    // Get scheduled date and time from slot if available, otherwise from scheduledAt
    let scheduledDate = null;
    let scheduledTime = null;

    if (booking.slotId && booking.slotId.date && booking.slotId.time) {
      scheduledDate = booking.slotId.date;
      scheduledTime = booking.slotId.time;
    } else if (booking.scheduledAt) {
      const scheduledDateTime = new Date(booking.scheduledAt);
      scheduledDate = scheduledDateTime.toISOString().split('T')[0];
      scheduledTime = scheduledDateTime.toTimeString().slice(0, 5);
    }

    // Format vehicle details
    const vehicleDetails = booking.vehicleId ? {
      category: booking.vehicleId.category,
      bodyType: booking.vehicleId.bodyType,
    } : null;

    return {
      ...booking,
      scheduledDate,
      scheduledTime,
      vehicleDetails,
    };
  }

  async cancelBooking(userId, id) {
    const booking = await Booking.findOne({ _id: id, userId });
    if (!booking) throw new NotFoundError('Booking not found');
    if (booking.status === 'cancelled') return booking;
    if (booking.status === 'completed') throw new BadRequestError('Completed bookings cannot be cancelled');

    // Release the slot if booking was confirmed or pending
    if (booking.status === 'pending' || booking.status === 'confirmed') {
      if (booking.slotId) {
        const slot = await Slot.findById(booking.slotId);
        if (slot && slot.status === 'booked' && slot.bookingId && slot.bookingId.toString() === booking._id.toString()) {
          slot.status = 'available';
          slot.bookingId = null;
          await slot.save();
        }
      }
    }

    booking.status = 'cancelled';
    await booking.save();
    return { message: 'Booking cancelled successfully' };
  }

  async submitFeedback(userId, id, { rating, comment }) {
    const booking = await Booking.findOne({ _id: id, userId });
    if (!booking) throw new NotFoundError('Booking not found');

    if (!rating || rating < 1 || rating > 5) {
      throw new BadRequestError('Rating must be between 1 and 5');
    }

    booking.feedback = {
      rating,
      comment: comment || '',
      createdAt: new Date(),
    };

    await booking.save();
    return { message: 'Feedback submitted successfully' };
  }
}

module.exports = new BookingService();


