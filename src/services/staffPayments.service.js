const Booking = require('../models/booking.model');
const StaffHandover = require('../models/staffHandover.model');
const { NotFoundError } = require('../utils/errors');

class StaffPaymentsService {
    /**
     * Get collections for a specific date with optional filter
     * @param {string} staffId - Staff member ID
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {string} filter - 'all' | 'cash' | 'online'
     */
    async getCollectionsByDate(staffId, date, filter = 'all') {
        // Parse date and set start/end of day
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // Build query for completed bookings with payment collection
        const query = {
            staffId,
            status: 'completed',
            'paymentCollection.collectedAt': {
                $gte: startOfDay,
                $lte: endOfDay,
            },
        };

        // Apply payment method filter
        if (filter === 'cash') {
            query['paymentCollection.method'] = 'cash';
        } else if (filter === 'online') {
            query['paymentCollection.method'] = 'online';
        } else if (filter === 'all') {
            // Include both cash and online (exclude prepaid since no collection needed from staff)
            query['paymentCollection.method'] = { $in: ['cash', 'online'] };
        }

        const bookings = await Booking.find(query)
            .populate({
                path: 'userId',
                select: 'name email phone',
                options: { lean: true }
            })
            .sort({ 'paymentCollection.collectedAt': -1 })
            .lean()
            .exec();

        // Calculate totals
        let cashTotal = 0;
        let onlineTotal = 0;

        const transactions = bookings.map((booking) => {
            // Calculate balance amount (what staff collected)
            const totalAmount = booking.totalAmount || booking.amount || 0;
            const advanceAmount = booking.advanceAmount || 0;
            const collectedAmount = totalAmount - advanceAmount;

            // Track totals by method
            if (booking.paymentCollection?.method === 'cash') {
                cashTotal += collectedAmount;
            } else if (booking.paymentCollection?.method === 'online') {
                onlineTotal += collectedAmount;
            }

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

            // Format time
            const collectedAt = new Date(booking.paymentCollection?.collectedAt);
            const timeStr = collectedAt.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });

            return {
                id: booking._id.toString(),
                time: timeStr,
                customer: customerName,
                service: booking.serviceName || 'Service',
                amount: collectedAmount,
                totalAmount,
                advanceAmount,
                method: booking.paymentCollection?.method || 'unknown',
            };
        });

        // Check handover status for this date
        const handover = await StaffHandover.findOne({
            staffId,
            date: startOfDay,
        }).lean();

        return {
            date,
            transactions,
            totals: {
                cash: cashTotal,
                online: onlineTotal,
                total: cashTotal + onlineTotal,
            },
            handoverStatus: handover?.status || 'pending',
            handoverReceivedAt: handover?.receivedAt || null,
        };
    }

    /**
     * Get collection summary for multiple dates (for staff dashboard)
     * @param {string} staffId - Staff member ID
     * @param {number} days - Number of past days to include
     */
    async getCollectionSummary(staffId, days = 7) {
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        // Get all completed bookings with collection in date range
        const bookings = await Booking.find({
            staffId,
            status: 'completed',
            'paymentCollection.method': { $in: ['cash', 'online'] },
            'paymentCollection.collectedAt': {
                $gte: startDate,
                $lte: endDate,
            },
        }).lean().exec();

        // Group by date
        const dailySummaries = {};

        bookings.forEach((booking) => {
            const collectedAt = new Date(booking.paymentCollection?.collectedAt);
            // Use local date formatting to avoid timezone issues
            const dateKey = `${collectedAt.getFullYear()}-${String(collectedAt.getMonth() + 1).padStart(2, '0')}-${String(collectedAt.getDate()).padStart(2, '0')}`;

            if (!dailySummaries[dateKey]) {
                dailySummaries[dateKey] = {
                    date: dateKey,
                    cash: 0,
                    online: 0,
                    total: 0,
                    count: 0,
                };
            }

            const totalAmount = booking.totalAmount || booking.amount || 0;
            const advanceAmount = booking.advanceAmount || 0;
            const collectedAmount = totalAmount - advanceAmount;

            if (booking.paymentCollection?.method === 'cash') {
                dailySummaries[dateKey].cash += collectedAmount;
            } else if (booking.paymentCollection?.method === 'online') {
                dailySummaries[dateKey].online += collectedAmount;
            }
            dailySummaries[dateKey].total += collectedAmount;
            dailySummaries[dateKey].count += 1;
        });

        // Get handover statuses for these dates
        const dates = Object.keys(dailySummaries).map(d => {
            const date = new Date(d);
            date.setHours(0, 0, 0, 0);
            return date;
        });

        const handovers = await StaffHandover.find({
            staffId,
            date: { $in: dates },
        }).lean().exec();

        const handoverMap = {};
        handovers.forEach(h => {
            // Use local date formatting to avoid timezone issues (same as getStaffCollections)
            const d = new Date(h.date);
            const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            handoverMap[dateKey] = h.status;
        });

        // Add handover status to summaries
        const result = Object.values(dailySummaries).map(summary => ({
            ...summary,
            handoverStatus: handoverMap[summary.date] || 'pending',
        }));

        // Sort by date descending
        result.sort((a, b) => new Date(b.date) - new Date(a.date));

        return result;
    }
}

module.exports = new StaffPaymentsService();
