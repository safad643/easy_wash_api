/**
 * Cleans MongoDB entries for:
 * - Users (non-admin only; admin users are kept)
 * - Reviews (booking feedback)
 * - Orders (product orders and service bookings)
 *
 * Also removes related data: addresses, vehicles, carts, refresh tokens,
 * notifications, push subscriptions, complaints, OTPs for affected users.
 *
 * Usage: node src/scripts/cleanUserData.js
 * Ensure MONGODB_URI is set (e.g. in .env).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/config');

const User = require('../models/user.model');
const ProductOrder = require('../models/productOrder.model');
const Booking = require('../models/booking.model');
const Address = require('../models/address.model');
const Vehicle = require('../models/vehicle.model');
const Cart = require('../models/cart.model');
const RefreshToken = require('../models/refreshToken.model');
const Notification = require('../models/notification.model');
const PushSubscription = require('../models/pushSubscription.model');
const Complaint = require('../models/complaint.model');
const OTP = require('../models/otp.model');

async function cleanUserData() {
  try {
    if (!config.mongodb?.uri) {
      console.error('Error: MONGODB_URI is not set (check .env)');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongodb.uri);
    console.log('Connected to MongoDB\n');

    // 1. Orders: delete all product orders
    const productOrderResult = await ProductOrder.deleteMany({});
    console.log(`Orders (product): deleted ${productOrderResult.deletedCount} documents`);

    // 2. Bookings (service orders) and reviews (feedback lives on bookings)
    const bookingResult = await Booking.deleteMany({});
    console.log(`Bookings (service orders + reviews): deleted ${bookingResult.deletedCount} documents`);

    // 3. Get non-admin user IDs
    const nonAdminUsers = await User.find({ role: { $ne: 'admin' } }).select('_id').lean();
    const nonAdminIds = nonAdminUsers.map((u) => u._id);

    if (nonAdminIds.length === 0) {
      console.log('No non-admin users found. Skipping user-related cleanup.');
      console.log('\nCleanup complete.');
      return;
    }

    // 4. Delete data that references these users
    const addressResult = await Address.deleteMany({ user: { $in: nonAdminIds } });
    console.log(`Addresses: deleted ${addressResult.deletedCount} documents`);

    const vehicleResult = await Vehicle.deleteMany({ user: { $in: nonAdminIds } });
    console.log(`Vehicles: deleted ${vehicleResult.deletedCount} documents`);

    const cartResult = await Cart.deleteMany({ user: { $in: nonAdminIds } });
    console.log(`Carts: deleted ${cartResult.deletedCount} documents`);

    const refreshResult = await RefreshToken.deleteMany({ userId: { $in: nonAdminIds } });
    console.log(`Refresh tokens: deleted ${refreshResult.deletedCount} documents`);

    const notifResult = await Notification.deleteMany({ userId: { $in: nonAdminIds } });
    console.log(`Notifications: deleted ${notifResult.deletedCount} documents`);

    const pushResult = await PushSubscription.deleteMany({ userId: { $in: nonAdminIds } });
    console.log(`Push subscriptions: deleted ${pushResult.deletedCount} documents`);

    const complaintResult = await Complaint.deleteMany({ userId: { $in: nonAdminIds } });
    console.log(`Complaints: deleted ${complaintResult.deletedCount} documents`);

    // OTP: no user ref; delete all (they're short-lived and often for customers)
    const otpResult = await OTP.deleteMany({});
    console.log(`OTPs: deleted ${otpResult.deletedCount} documents`);

    // 5. Delete non-admin users
    const userResult = await User.deleteMany({ _id: { $in: nonAdminIds } });
    console.log(`Users (non-admin): deleted ${userResult.deletedCount} documents`);

    console.log('\nCleanup complete. Admin users and all other collections were left unchanged.');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

cleanUserData();
