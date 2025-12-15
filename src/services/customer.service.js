const User = require('../models/user.model');
const Booking = require('../models/booking.model');
const ProductOrder = require('../models/productOrder.model');
const Vehicle = require('../models/vehicle.model');
const VehicleCategory = require('../models/vehicleCategory.model');
const Address = require('../models/address.model');
const { NotFoundError } = require('../utils/errors');

class CustomerService {
    async getCustomerList(filters = {}) {
        const { status, search, page = 1, limit = 10 } = filters;

        const query = { role: 'customer' };

        if (status) {
            query.status = status;
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

        const customers = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const formattedCustomers = await Promise.all(
            customers.map((c) => this.formatCustomerResponse(c))
        );

        // Calculate stats
        const totalCustomers = await User.countDocuments({ role: 'customer' });
        const activeCustomers = await User.countDocuments({ role: 'customer', status: 'active' });
        const suspendedCustomers = await User.countDocuments({ role: 'customer', status: 'suspended' });

        return {
            data: formattedCustomers,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit),
            stats: {
                total: totalCustomers,
                active: activeCustomers,
                suspended: suspendedCustomers,
            },
        };
    }

    async getCustomerById(id) {
        const customer = await User.findOne({ _id: id, role: 'customer' }).select('-password');
        if (!customer) {
            throw new NotFoundError('Customer not found');
        }

        return this.formatCustomerDetailResponse(customer);
    }

    async updateCustomerStatus(id, status) {
        if (!['active', 'suspended'].includes(status)) {
            throw new NotFoundError('Invalid status. Must be active or suspended');
        }

        const customer = await User.findOneAndUpdate(
            { _id: id, role: 'customer' },
            { status },
            { new: true }
        ).select('-password');

        if (!customer) {
            throw new NotFoundError('Customer not found');
        }

        return this.formatCustomerResponse(customer);
    }

    async formatCustomerResponse(customer) {
        const stats = await this.getCustomerStats(customer._id);

        return {
            id: customer._id.toString(),
            name: customer.name || 'Unknown',
            email: customer.email || '',
            phone: customer.phone || '',
            status: customer.status || 'active',
            avatar: customer.avatar,
            joinedDate: customer.createdAt.toISOString().split('T')[0],
            totalOrders: stats.totalOrders,
            totalBookings: stats.totalBookings,
            totalSpent: stats.totalSpent,
            lastOrderDate: stats.lastOrderDate,
        };
    }

    async formatCustomerDetailResponse(customer) {
        const stats = await this.getCustomerStats(customer._id);
        const vehicles = await this.getCustomerVehicles(customer._id);
        const addresses = await this.getCustomerAddresses(customer._id);
        const recentOrders = await this.getRecentOrders(customer._id);
        const recentBookings = await this.getRecentBookings(customer._id);

        return {
            id: customer._id.toString(),
            name: customer.name || 'Unknown',
            email: customer.email || '',
            phone: customer.phone || '',
            status: customer.status || 'active',
            avatar: customer.avatar,
            joinedDate: customer.createdAt.toISOString().split('T')[0],
            totalOrders: stats.totalOrders,
            totalBookings: stats.totalBookings,
            totalSpent: stats.totalSpent,
            lastOrderDate: stats.lastOrderDate,
            vehicles,
            addresses,
            recentOrders,
            recentBookings,
            orderStats: stats.orderStats,
        };
    }

    async getCustomerStats(customerId) {
        const [productOrders, bookings] = await Promise.all([
            ProductOrder.find({ userId: customerId }),
            Booking.find({ userId: customerId }),
        ]);

        const totalOrders = productOrders.length;
        const totalBookings = bookings.length;

        const productSpent = productOrders
            .filter((o) => o.paymentStatus === 'paid')
            .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        const bookingSpent = bookings
            .filter((b) => b.paymentStatus === 'paid')
            .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

        const totalSpent = productSpent + bookingSpent;

        // Get last order date
        const allDates = [
            ...productOrders.map((o) => o.createdAt),
            ...bookings.map((b) => b.createdAt),
        ].filter(Boolean);

        const lastOrderDate = allDates.length > 0
            ? new Date(Math.max(...allDates.map((d) => d.getTime()))).toISOString().split('T')[0]
            : null;

        // Order stats
        const orderStats = {
            completed: productOrders.filter((o) => o.status === 'delivered').length +
                bookings.filter((b) => b.status === 'completed').length,
            cancelled: productOrders.filter((o) => o.status === 'cancelled').length +
                bookings.filter((b) => b.status === 'cancelled').length,
            pending: productOrders.filter((o) => ['pending', 'confirmed', 'processing', 'shipped'].includes(o.status)).length +
                bookings.filter((b) => ['pending', 'confirmed', 'in_progress'].includes(b.status)).length,
        };

        return { totalOrders, totalBookings, totalSpent, lastOrderDate, orderStats };
    }

    async getCustomerVehicles(customerId) {
        const vehicles = await Vehicle.find({ user: customerId }).limit(10);

        // Get unique categories and fetch their icons
        const categoryNames = [...new Set(vehicles.map(v => v.category).filter(Boolean))];
        const categories = await VehicleCategory.find({ slug: { $in: categoryNames } });
        const categoryIconMap = {};
        categories.forEach(cat => {
            categoryIconMap[cat.slug] = cat.icon || '🚗';
        });

        return vehicles.map((v) => ({
            id: v._id.toString(),
            brand: v.category || '',
            model: v.bodyType || '',
            number: v.number || '',
            type: v.category || '',
            icon: categoryIconMap[v.category] || '🚗',
        }));
    }

    async getCustomerAddresses(customerId) {
        const addresses = await Address.find({ user: customerId }).limit(10);
        return addresses.map((a) => ({
            id: a._id.toString(),
            type: a.label || 'Home',
            address: [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', '),
            isPrimary: a.isPrimary || false,
        }));
    }

    async getRecentOrders(customerId) {
        const orders = await ProductOrder.find({ userId: customerId })
            .sort({ createdAt: -1 })
            .limit(5);

        return orders.map((o) => ({
            id: o._id.toString(),
            type: 'product',
            amount: o.totalAmount || 0,
            status: o.status,
            date: o.createdAt.toISOString(),
        }));
    }

    async getRecentBookings(customerId) {
        const bookings = await Booking.find({ userId: customerId })
            .sort({ createdAt: -1 })
            .limit(5);

        return bookings.map((b) => ({
            id: b._id.toString(),
            type: 'service',
            service: b.serviceName || 'Service',
            amount: b.totalAmount || 0,
            status: b.status,
            date: b.createdAt.toISOString(),
        }));
    }
}

module.exports = new CustomerService();
