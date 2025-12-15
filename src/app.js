const express = require('express');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const serviceRoutes = require('./routes/service.routes');
const bookingRoutes = require('./routes/booking.routes');
const adminRequestsRoutes = require('./routes/admin.requests.routes');
const cartRoutes = require('./routes/cart.routes');
const addressRoutes = require('./routes/address.routes');
const vehicleRoutes = require('./routes/vehicle.routes');
const profileRoutes = require('./routes/profile.routes');
const checkoutRoutes = require('./routes/checkout.routes');
const categoryRoutes = require('./routes/category.routes');
const staffRoutes = require('./routes/staff.routes');
const staffJobRoutes = require('./routes/staffJob.routes');
const ordersRoutes = require('./routes/orders.routes');
const adminOrdersRoutes = require('./routes/admin.orders.routes');
const posterRoutes = require('./routes/poster.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const settingsRoutes = require('./routes/settings.routes');
const vehicleTypeRoutes = require('./routes/vehicleType.routes');
const reportRoutes = require('./routes/report.routes');
const paymentRoutes = require('./routes/payment.routes');
const customerRoutes = require('./routes/customer.routes');
const addonRoutes = require('./routes/addon.routes');
const complaintRoutes = require('./routes/complaint.routes');
const errorHandler = require('./middlewares/error.middleware');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin/requests', adminRequestsRoutes);
app.use('/api/admin/staff', staffRoutes);
app.use('/api/staff/jobs', staffJobRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/admin/orders', adminOrdersRoutes);
app.use('/api/posters', posterRoutes.publicRouter);
app.use('/api/admin/posters', posterRoutes.adminRouter);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api', settingsRoutes.publicRouter);
app.use('/api/admin/settings', settingsRoutes.adminRouter);
app.use('/api/vehicle-types', vehicleTypeRoutes.publicRouter);
app.use('/api/admin/vehicle-types', vehicleTypeRoutes.adminRouter);
app.use('/api/admin/reports', reportRoutes);
app.use('/api/admin/payments', paymentRoutes);
app.use('/api/admin/customers', customerRoutes);
app.use('/api/addons', addonRoutes.publicRouter);
app.use('/api/admin/addons', addonRoutes.adminRouter);
app.use('/api/complaints', complaintRoutes.customerRouter);
app.use('/api/admin/complaints', complaintRoutes.adminRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.use(errorHandler);

module.exports = app;
