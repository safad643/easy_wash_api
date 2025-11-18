const User = require('../models/user.model');
const Booking = require('../models/booking.model');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { BadRequestError, NotFoundError } = require('../utils/errors');

class StaffService {
  async createStaff(staffData) {
    const { name, email, phone, password, skills, status } = staffData;

    // Validate required fields
    if (!name || !email || !phone) {
      throw new BadRequestError('Name, email, and phone are required');
    }

    // Password is required for new staff
    if (!password) {
      throw new BadRequestError('Password is required');
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }],
    });

    if (existingUser) {
      throw new BadRequestError('User with this email or phone already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create staff user
    // Always set role='staff' for authorization
    const staff = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      role: 'staff', // Always 'staff' for authorization
      skills: skills || [],
      status: status || 'active',
    });

    return this.formatStaffResponse(staff);
  }

  async getStaffList(filters = {}) {
    const {
      status,
      role,
      search,
      page = 1,
      limit = 10,
    } = filters;

    const query = { role: 'staff' };

    // Apply filters
    if (status) {
      query.status = status;
    }
    if (role) {
      query.role = role;
    }
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
        { phone: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const total = await User.countDocuments(query);

    const staff = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Format and enrich with stats
    const formattedStaff = await Promise.all(
      staff.map((s) => this.formatStaffResponse(s))
    );

    return {
      data: formattedStaff,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStaffById(id) {
    const staff = await User.findOne({ _id: id, role: 'staff' }).select('-password');
    if (!staff) {
      throw new NotFoundError('Staff member not found');
    }

    return this.formatStaffDetailResponse(staff);
  }

  async updateStaff(id, updateData) {
    const staff = await User.findOne({ _id: id, role: 'staff' });
    if (!staff) {
      throw new NotFoundError('Staff member not found');
    }

    // Don't allow changing the role from 'staff'
    if (updateData.role && updateData.role !== 'staff') {
      throw new BadRequestError('Cannot change staff authorization role');
    }
    // Always keep role as 'staff'
    delete updateData.role;

    // Handle password update - hash it before saving
    // Only update password if it's provided and not empty
    if (updateData.password !== undefined) {
      if (!updateData.password || updateData.password.trim() === '') {
        // Remove password from update if it's empty (don't update password)
        delete updateData.password;
      } else {
        // Hash the new password
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }
    }

    // If email or phone is being updated, check for duplicates
    if (updateData.email || updateData.phone) {
      const existingUser = await User.findOne({
        $or: [
          updateData.email ? { email: updateData.email.toLowerCase() } : {},
          updateData.phone ? { phone: updateData.phone } : {},
        ],
        _id: { $ne: id },
      });

      if (existingUser) {
        throw new BadRequestError('User with this email or phone already exists');
      }

      if (updateData.email) {
        updateData.email = updateData.email.toLowerCase();
      }
    }

    // Update staff
    const updatedStaff = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select('-password');

    return this.formatStaffDetailResponse(updatedStaff);
  }

  async deleteStaff(id) {
    const staff = await User.findOne({ _id: id, role: 'staff' });
    if (!staff) {
      throw new NotFoundError('Staff member not found');
    }

    // Check if staff has any bookings (optional - you might want to prevent deletion if they have bookings)
    // For now, we'll just delete the staff member
    await User.findByIdAndDelete(id);

    return { message: 'Staff member deleted successfully' };
  }

  async updateStaffStatus(id, status) {
    if (!['active', 'suspended'].includes(status)) {
      throw new BadRequestError('Invalid status. Must be active or suspended');
    }

    const staff = await User.findOneAndUpdate(
      { _id: id, role: 'staff' },
      { status },
      { new: true }
    ).select('-password');

    if (!staff) {
      throw new NotFoundError('Staff member not found');
    }

    return this.formatStaffDetailResponse(staff);
  }

  // Helper method to format staff response with stats
  async formatStaffResponse(staff) {
    const stats = await this.getStaffStats(staff._id);
    
    return {
      id: staff._id.toString(),
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      role: staff.role, // Always 'staff' for authorization
      status: staff.status || 'active',
      totalJobs: stats.totalJobs,
      avgRating: stats.avgRating,
      earnings: stats.earnings,
      avatar: staff.avatar,
      joinedDate: staff.createdAt.toISOString().split('T')[0],
    };
  }

  // Helper method to format staff detail response
  async formatStaffDetailResponse(staff) {
    const stats = await this.getStaffStats(staff._id);
    const recentJobs = await this.getRecentJobs(staff._id);
    const performanceMetrics = await this.getPerformanceMetrics(staff._id);

    return {
      id: staff._id.toString(),
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      role: staff.role, // Always 'staff' for authorization
      status: staff.status || 'active',
      totalJobs: stats.totalJobs,
      avgRating: stats.avgRating,
      earnings: stats.earnings,
      avatar: staff.avatar,
      joinedDate: staff.createdAt.toISOString().split('T')[0],
      skills: staff.skills || [],
      recentJobs: recentJobs,
      performanceMetrics: performanceMetrics,
    };
  }

  // Helper method to get staff statistics
  async getStaffStats(staffId) {
    // For now, return placeholder values since bookings don't have staffId yet
    // TODO: Update this when staff assignment is implemented
    const totalJobs = 0;
    const avgRating = 0;
    const earnings = 0;

    // When staff assignment is implemented, uncomment and use:
    // const bookings = await Booking.find({ staffId: staffId });
    // const totalJobs = bookings.length;
    // const completedBookings = bookings.filter(b => b.status === 'completed');
    // const avgRating = completedBookings.length > 0
    //   ? completedBookings.reduce((sum, b) => sum + (b.feedback?.rating || 0), 0) / completedBookings.length
    //   : 0;
    // const earnings = completedBookings.reduce((sum, b) => sum + (b.amount || 0), 0);

    return { totalJobs, avgRating, earnings };
  }

  // Helper method to get recent jobs
  async getRecentJobs(staffId) {
    // For now, return empty array since bookings don't have staffId yet
    // TODO: Update this when staff assignment is implemented
    return [];

    // When staff assignment is implemented, uncomment and use:
    // const bookings = await Booking.find({ staffId: staffId })
    //   .sort({ createdAt: -1 })
    //   .limit(10)
    //   .populate('userId', 'name')
    //   .populate('serviceId', 'name');
    // return bookings.map(b => ({
    //   id: b._id.toString(),
    //   service: b.serviceName || 'Service',
    //   customer: b.userId?.name || 'Customer',
    //   date: b.scheduledAt.toISOString(),
    //   status: b.status,
    //   amount: b.amount || 0,
    // }));
  }

  // Helper method to get performance metrics
  async getPerformanceMetrics(staffId) {
    // For now, return placeholder values
    // TODO: Update this when staff assignment is implemented
    return {
      completionRate: 0,
      onTimeRate: 0,
      customerSatisfaction: 0,
    };

    // When staff assignment is implemented, calculate actual metrics:
    // const bookings = await Booking.find({ staffId: staffId });
    // const total = bookings.length;
    // const completed = bookings.filter(b => b.status === 'completed').length;
    // const onTime = bookings.filter(b => b.status === 'completed' && /* on time logic */).length;
    // const ratings = bookings.filter(b => b.feedback?.rating).map(b => b.feedback.rating);
    // const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    // return {
    //   completionRate: total > 0 ? (completed / total) * 100 : 0,
    //   onTimeRate: completed > 0 ? (onTime / completed) * 100 : 0,
    //   customerSatisfaction: avgRating,
    // };
  }
}

module.exports = new StaffService();

