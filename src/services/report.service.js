const ProductOrder = require('../models/productOrder.model');
const Booking = require('../models/booking.model');
const PDFDocument = require('pdfkit');

class ReportService {
    /**
     * Build date filter based on preset or custom range
     */
    buildDateFilter(query) {
        const { preset, startDate, endDate } = query;
        const now = new Date();
        let dateFilter = {};

        if (startDate && endDate) {
            // Custom date range
            dateFilter = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
                }
            };
        } else if (preset) {
            let start;
            switch (preset) {
                case 'today':
                    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    dateFilter = { createdAt: { $gte: start } };
                    break;
                case 'week':
                    start = new Date(now);
                    start.setDate(now.getDate() - 7);
                    dateFilter = { createdAt: { $gte: start } };
                    break;
                case 'month':
                    start = new Date(now.getFullYear(), now.getMonth(), 1);
                    dateFilter = { createdAt: { $gte: start } };
                    break;
                case 'year':
                    start = new Date(now.getFullYear(), 0, 1);
                    dateFilter = { createdAt: { $gte: start } };
                    break;
                case 'all':
                default:
                    // No date filter
                    break;
            }
        }

        return dateFilter;
    }

    /**
     * Get orders report with filters
     */
    async getOrdersReport(query = {}) {
        const { status, paymentStatus, search, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 20 } = query;

        const dateFilter = this.buildDateFilter(query);
        const filter = { ...dateFilter };

        if (status) {
            filter.status = status;
        }
        if (paymentStatus) {
            filter.paymentStatus = paymentStatus;
        }

        // Build query
        let ordersQuery = ProductOrder.find(filter)
            .populate('userId', 'name email phone');

        // Search
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            ordersQuery = ProductOrder.find({
                ...filter,
                $or: [
                    { orderNumber: searchRegex },
                    { 'deliveryAddress.phone': searchRegex }
                ]
            }).populate('userId', 'name email phone');
        }

        // Sorting
        const sortDirection = sortOrder === 'asc' ? 1 : -1;
        ordersQuery = ordersQuery.sort({ [sortBy]: sortDirection });

        // Pagination
        const skip = (Number(page) - 1) * Number(limit);
        const total = await ProductOrder.countDocuments(filter);

        const orders = await ordersQuery.skip(skip).limit(Number(limit)).lean();

        return {
            orders: orders.map(order => ({
                id: order._id.toString(),
                orderNumber: order.orderNumber,
                customerName: order.userId?.name || 'Unknown',
                customerEmail: order.userId?.email || '',
                customerPhone: order.userId?.phone || order.deliveryAddress?.phone || '',
                date: order.createdAt,
                itemsCount: order.items?.length || 0,
                paymentMethod: order.paymentMethod || 'N/A',
                subtotal: order.subtotal || 0,
                discount: order.discount || 0,
                tax: order.tax || 0,
                shippingFee: order.shippingFee || 0,
                totalAmount: order.totalAmount || 0,
                status: order.status,
                paymentStatus: order.paymentStatus,
            })),
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        };
    }

    /**
     * Get bookings report with filters
     */
    async getBookingsReport(query = {}) {
        const { status, paymentStatus, search, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 20 } = query;

        const dateFilter = this.buildDateFilter(query);
        const filter = { ...dateFilter };

        if (status) {
            filter.status = status;
        }
        if (paymentStatus) {
            filter.paymentStatus = paymentStatus;
        }

        // Build query
        let bookingsQuery = Booking.find(filter)
            .populate('userId', 'name email phone')
            .populate('staffId', 'name');

        // Search
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            bookingsQuery = Booking.find({
                ...filter,
                $or: [
                    { serviceName: searchRegex },
                    { 'address.phone': searchRegex }
                ]
            }).populate('userId', 'name email phone').populate('staffId', 'name');
        }

        // Sorting
        const sortDirection = sortOrder === 'asc' ? 1 : -1;
        bookingsQuery = bookingsQuery.sort({ [sortBy]: sortDirection });

        // Pagination
        const skip = (Number(page) - 1) * Number(limit);
        const total = await Booking.countDocuments(filter);

        const bookings = await bookingsQuery.skip(skip).limit(Number(limit)).lean();

        return {
            bookings: bookings.map(booking => ({
                id: booking._id.toString(),
                customerName: booking.userId?.name || 'Unknown',
                customerEmail: booking.userId?.email || '',
                customerPhone: booking.userId?.phone || booking.address?.phone || '',
                serviceName: booking.serviceName || 'N/A',
                vehicleCategory: booking.vehicle?.category || 'N/A',
                vehicleBodyType: booking.vehicle?.bodyType || 'N/A',
                scheduledAt: booking.scheduledAt,
                addOnsCount: booking.addOns?.length || 0,
                amount: booking.amount || 0,
                totalAmount: booking.totalAmount || booking.amount || 0,
                paymentType: booking.paymentType || 'full',
                paymentStatus: booking.paymentStatus,
                status: booking.status,
                staffName: booking.staffId?.name || 'Unassigned',
                createdAt: booking.createdAt,
            })),
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        };
    }

    /**
     * Get report summary
     */
    async getReportSummary(query = {}, type = 'orders') {
        const dateFilter = this.buildDateFilter(query);
        const { status, paymentStatus } = query;
        const filter = { ...dateFilter };

        if (status) filter.status = status;
        if (paymentStatus) filter.paymentStatus = paymentStatus;

        if (type === 'orders') {
            const [stats, statusBreakdown] = await Promise.all([
                ProductOrder.aggregate([
                    { $match: filter },
                    {
                        $group: {
                            _id: null,
                            totalCount: { $sum: 1 },
                            totalRevenue: { $sum: '$totalAmount' },
                            avgOrderValue: { $avg: '$totalAmount' },
                            totalDiscount: { $sum: '$discount' },
                            totalTax: { $sum: '$tax' },
                            totalShipping: { $sum: '$shippingFee' }
                        }
                    }
                ]),
                ProductOrder.aggregate([
                    { $match: filter },
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ])
            ]);

            return {
                totalCount: stats[0]?.totalCount || 0,
                totalRevenue: stats[0]?.totalRevenue || 0,
                avgOrderValue: Math.round(stats[0]?.avgOrderValue || 0),
                totalDiscount: stats[0]?.totalDiscount || 0,
                totalTax: stats[0]?.totalTax || 0,
                totalShipping: stats[0]?.totalShipping || 0,
                statusBreakdown: statusBreakdown.map(s => ({ status: s._id, count: s.count }))
            };
        } else {
            const [stats, statusBreakdown] = await Promise.all([
                Booking.aggregate([
                    { $match: filter },
                    {
                        $group: {
                            _id: null,
                            totalCount: { $sum: 1 },
                            totalRevenue: { $sum: '$amount' },
                            avgBookingValue: { $avg: '$amount' }
                        }
                    }
                ]),
                Booking.aggregate([
                    { $match: filter },
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ])
            ]);

            return {
                totalCount: stats[0]?.totalCount || 0,
                totalRevenue: stats[0]?.totalRevenue || 0,
                avgBookingValue: Math.round(stats[0]?.avgBookingValue || 0),
                statusBreakdown: statusBreakdown.map(s => ({ status: s._id, count: s.count }))
            };
        }
    }

    /**
     * Generate PDF report for orders
     */
    async generateOrdersPdf(query, res) {
        // Get all orders (no pagination for export)
        const reportQuery = { ...query, page: 1, limit: 10000 };
        const { orders } = await this.getOrdersReport(reportQuery);
        const summary = await this.getReportSummary(query, 'orders');

        const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=orders-report-${Date.now()}.pdf`);
        doc.pipe(res);

        this.generatePdfHeader(doc, 'Orders Report', query);
        this.generateOrdersSummary(doc, summary);
        this.generateOrdersTable(doc, orders);
        this.generatePdfFooter(doc);

        doc.end();
    }

    /**
     * Generate PDF report for bookings
     */
    async generateBookingsPdf(query, res) {
        const reportQuery = { ...query, page: 1, limit: 10000 };
        const { bookings } = await this.getBookingsReport(reportQuery);
        const summary = await this.getReportSummary(query, 'bookings');

        const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=bookings-report-${Date.now()}.pdf`);
        doc.pipe(res);

        this.generatePdfHeader(doc, 'Bookings Report', query);
        this.generateBookingsSummary(doc, summary);
        this.generateBookingsTable(doc, bookings);
        this.generatePdfFooter(doc);

        doc.end();
    }

    /**
     * PDF Header with company info and report title
     */
    generatePdfHeader(doc, title, query) {
        const pageWidth = doc.page.width - 80;

        // Header background
        doc.rect(40, 40, pageWidth, 60).fill('#1a365d');

        // Title
        doc.fontSize(24).fillColor('#ffffff').font('Helvetica-Bold')
            .text(title, 50, 55);

        // Date range info
        let dateRangeText = 'All Time';
        if (query.startDate && query.endDate) {
            dateRangeText = `${new Date(query.startDate).toLocaleDateString()} - ${new Date(query.endDate).toLocaleDateString()}`;
        } else if (query.preset) {
            const presetLabels = { today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year', all: 'All Time' };
            dateRangeText = presetLabels[query.preset] || 'All Time';
        }

        doc.fontSize(10).fillColor('#ffffff').font('Helvetica')
            .text(`Period: ${dateRangeText}`, 50, 80);

        doc.fontSize(10)
            .text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 100, 80, { align: 'right' });

        doc.moveDown(3);
    }

    /**
     * Orders summary section
     */
    generateOrdersSummary(doc, summary) {
        const y = 120;
        const cardWidth = 120;
        const startX = 50;

        doc.fontSize(12).fillColor('#1a365d').font('Helvetica-Bold')
            .text('Summary', startX, y);

        const summaryCards = [
            { label: 'Total Orders', value: summary.totalCount.toLocaleString() },
            { label: 'Total Revenue', value: `Rs.${summary.totalRevenue.toLocaleString()}` },
            { label: 'Avg Order Value', value: `Rs.${summary.avgOrderValue.toLocaleString()}` },
            { label: 'Total Discount', value: `Rs.${summary.totalDiscount.toLocaleString()}` },
            { label: 'Total Tax', value: `Rs.${summary.totalTax.toLocaleString()}` },
        ];

        summaryCards.forEach((card, i) => {
            const x = startX + (i * (cardWidth + 10));
            doc.rect(x, y + 20, cardWidth, 50).fill('#f7fafc').stroke('#e2e8f0');
            doc.fontSize(8).fillColor('#718096').font('Helvetica')
                .text(card.label, x + 10, y + 30);
            doc.fontSize(14).fillColor('#1a202c').font('Helvetica-Bold')
                .text(card.value, x + 10, y + 45);
        });

        doc.moveDown(5);
    }

    /**
     * Bookings summary section
     */
    generateBookingsSummary(doc, summary) {
        const y = 120;
        const cardWidth = 150;
        const startX = 50;

        doc.fontSize(12).fillColor('#1a365d').font('Helvetica-Bold')
            .text('Summary', startX, y);

        const summaryCards = [
            { label: 'Total Bookings', value: summary.totalCount.toLocaleString() },
            { label: 'Total Revenue', value: `Rs.${summary.totalRevenue.toLocaleString()}` },
            { label: 'Avg Booking Value', value: `Rs.${summary.avgBookingValue.toLocaleString()}` },
        ];

        summaryCards.forEach((card, i) => {
            const x = startX + (i * (cardWidth + 10));
            doc.rect(x, y + 20, cardWidth, 50).fill('#f7fafc').stroke('#e2e8f0');
            doc.fontSize(8).fillColor('#718096').font('Helvetica')
                .text(card.label, x + 10, y + 30);
            doc.fontSize(14).fillColor('#1a202c').font('Helvetica-Bold')
                .text(card.value, x + 10, y + 45);
        });

        doc.moveDown(5);
    }

    /**
     * Orders table
     */
    generateOrdersTable(doc, orders) {
        const startY = 200;
        const rowHeight = 24;
        const startX = 40;
        const tableWidth = doc.page.width - 80;

        // Calculate proportional column widths to fill the page
        // Order #, Customer, Date, Items, Subtotal, Discount, Total, Status, Payment
        const colRatios = [0.10, 0.18, 0.10, 0.07, 0.11, 0.11, 0.11, 0.11, 0.11];
        const colWidths = colRatios.map(ratio => Math.floor(tableWidth * ratio));
        const headers = ['Order #', 'Customer', 'Date', 'Items', 'Subtotal', 'Discount', 'Total', 'Status', 'Payment'];

        // Table header
        doc.rect(startX, startY, tableWidth, rowHeight).fill('#1a365d');
        let x = startX + 5;
        headers.forEach((header, i) => {
            doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold')
                .text(header, x, startY + 7, { width: colWidths[i] - 10 });
            x += colWidths[i];
        });

        // Table rows
        let y = startY + rowHeight;
        orders.slice(0, 25).forEach((order, rowIndex) => {
            if (y > doc.page.height - 60) {
                doc.addPage();
                y = 40;
            }

            const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f7fafc';
            doc.rect(startX, y, tableWidth, rowHeight).fill(bgColor);

            x = startX + 5;
            const rowData = [
                order.orderNumber || order.id.slice(-8),
                order.customerName,
                new Date(order.date).toLocaleDateString(),
                order.itemsCount.toString(),
                `Rs.${order.subtotal.toLocaleString()}`,
                `Rs.${order.discount.toLocaleString()}`,
                `Rs.${order.totalAmount.toLocaleString()}`,
                order.status,
                order.paymentStatus
            ];

            rowData.forEach((cell, i) => {
                doc.fontSize(9).fillColor('#1a202c').font('Helvetica')
                    .text(cell, x, y + 7, { width: colWidths[i] - 10 });
                x += colWidths[i];
            });

            y += rowHeight;
        });

        if (orders.length > 25) {
            doc.fontSize(10).fillColor('#718096').font('Helvetica-Oblique')
                .text(`... and ${orders.length - 25} more orders`, startX, y + 10);
        }
    }

    /**
     * Bookings table
     */
    generateBookingsTable(doc, bookings) {
        const startY = 200;
        const rowHeight = 24;
        const startX = 40;
        const tableWidth = doc.page.width - 80;

        // Calculate proportional column widths to fill the page
        // ID, Customer, Service, Vehicle, Scheduled, Amount, Status, Payment
        const colRatios = [0.10, 0.16, 0.18, 0.14, 0.12, 0.10, 0.10, 0.10];
        const colWidths = colRatios.map(ratio => Math.floor(tableWidth * ratio));
        const headers = ['ID', 'Customer', 'Service', 'Vehicle', 'Scheduled', 'Amount', 'Status', 'Payment'];

        // Table header
        doc.rect(startX, startY, tableWidth, rowHeight).fill('#1a365d');
        let x = startX + 5;
        headers.forEach((header, i) => {
            doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold')
                .text(header, x, startY + 7, { width: colWidths[i] - 10 });
            x += colWidths[i];
        });

        // Table rows
        let y = startY + rowHeight;
        bookings.slice(0, 25).forEach((booking, rowIndex) => {
            if (y > doc.page.height - 60) {
                doc.addPage();
                y = 40;
            }

            const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f7fafc';
            doc.rect(startX, y, tableWidth, rowHeight).fill(bgColor);

            x = startX + 5;
            const rowData = [
                booking.id.slice(-8),
                booking.customerName,
                booking.serviceName,
                `${booking.vehicleCategory} ${booking.vehicleBodyType}`,
                new Date(booking.scheduledAt).toLocaleDateString(),
                `Rs.${booking.amount.toLocaleString()}`,
                booking.status,
                booking.paymentStatus
            ];

            rowData.forEach((cell, i) => {
                doc.fontSize(9).fillColor('#1a202c').font('Helvetica')
                    .text(cell, x, y + 7, { width: colWidths[i] - 10 });
                x += colWidths[i];
            });

            y += rowHeight;
        });

        if (bookings.length > 25) {
            doc.fontSize(10).fillColor('#718096').font('Helvetica-Oblique')
                .text(`... and ${bookings.length - 25} more bookings`, startX, y + 10);
        }
    }

    /**
     * PDF Footer
     */
    generatePdfFooter(doc) {
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).fillColor('#718096').font('Helvetica')
                .text(
                    `Page ${i + 1} of ${pageCount} | Eazy Wash Services`,
                    40,
                    doc.page.height - 30,
                    { align: 'center', width: doc.page.width - 80 }
                );
        }
    }

    /**
     * Generate CSV for orders
     */
    async generateOrdersCsv(query) {
        const reportQuery = { ...query, page: 1, limit: 10000 };
        const { orders } = await this.getOrdersReport(reportQuery);

        const headers = ['Order Number', 'Customer Name', 'Customer Email', 'Customer Phone', 'Date', 'Items Count', 'Payment Method', 'Subtotal', 'Discount', 'Tax', 'Shipping', 'Total', 'Status', 'Payment Status'];

        const rows = orders.map(order => [
            order.orderNumber,
            order.customerName,
            order.customerEmail,
            order.customerPhone,
            new Date(order.date).toLocaleString(),
            order.itemsCount,
            order.paymentMethod,
            order.subtotal,
            order.discount,
            order.tax,
            order.shippingFee,
            order.totalAmount,
            order.status,
            order.paymentStatus
        ]);

        return [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    }

    /**
     * Generate CSV for bookings
     */
    async generateBookingsCsv(query) {
        const reportQuery = { ...query, page: 1, limit: 10000 };
        const { bookings } = await this.getBookingsReport(reportQuery);

        const headers = ['Booking ID', 'Customer Name', 'Customer Email', 'Customer Phone', 'Service', 'Vehicle Category', 'Vehicle Type', 'Scheduled Date', 'Add-ons', 'Amount', 'Total', 'Payment Type', 'Payment Status', 'Status', 'Staff'];

        const rows = bookings.map(booking => [
            booking.id,
            booking.customerName,
            booking.customerEmail,
            booking.customerPhone,
            booking.serviceName,
            booking.vehicleCategory,
            booking.vehicleBodyType,
            new Date(booking.scheduledAt).toLocaleString(),
            booking.addOnsCount,
            booking.amount,
            booking.totalAmount,
            booking.paymentType,
            booking.paymentStatus,
            booking.status,
            booking.staffName
        ]);

        return [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    }
}

module.exports = new ReportService();
