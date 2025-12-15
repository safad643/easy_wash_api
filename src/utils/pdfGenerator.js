const PDFDocument = require('pdfkit');

// Color palette
const COLORS = {
  primary: '#1a365d',      // Dark navy blue
  secondary: '#2d3748',    // Dark gray
  accent: '#3182ce',       // Blue accent
  lightGray: '#e2e8f0',
  text: '#1a202c',
  mutedText: '#718096',
  white: '#ffffff',
  success: '#38a169',
};

// Fallback company info
const FALLBACK_COMPANY = {
  companyName: 'Eazy Wash Services',
  address: '456 Service Road, Sector 5',
  city: 'Bengaluru, Karnataka - 560103',
  phone: '+91 80 5555 1111',
  email: 'billing@eazywash.com',
  gst: 'GSTIN29ABCDE1234F1Z5',
  website: 'www.eazywash.com',
};

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Generate PDF invoice for Booking or ProductOrder
 * @param {Object} order - Booking or Order document
 * @param {Object} res - Express response object
 */
const streamInvoice = (order, res) => {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    bufferPages: true,
  });

  // Determine if this is a Booking or Product Order
  const isBooking = !!order.serviceName; // Bookings have serviceName

  const orderId = (order._id || order.id || '').toString();
  const orderNumber = order.orderNumber || (order.bookingNumber || orderId.slice(-8).toUpperCase());

  // Normalize data
  const company = order.invoiceDetails || FALLBACK_COMPANY;

  // Normalize address
  let address = {};
  if (order.deliveryAddress) {
    address = order.deliveryAddress;
  } else if (order.address) {
    address = order.address;
  }

  // Normalize items
  let items = [];
  if (order.items && order.items.length > 0) {
    // Product Order items
    items = order.items;
  } else if (isBooking) {
    // Booking items (Service + Add-ons)

    // 1. Main Service (with Vehicle info)
    const vehicleInfo = order.vehicle ? `${order.vehicle.category} - ${order.vehicle.bodyType}` : '';
    items.push({
      name: `${order.serviceName} (${vehicleInfo})`,
      quantity: 1,
      price: order.amount || 0, // Base amount before tax/addons if stored separate? Assuming 'amount' is total or base
      subtotal: order.amount || 0, // For simple display
    });

    // 2. Add-ons
    if (order.addOns && order.addOns.length > 0) {
      order.addOns.forEach(addon => {
        items.push({
          name: `Add-on: ${addon.name}`,
          quantity: 1,
          price: addon.price || 0,
          subtotal: addon.price || 0,
        });
      });
    }
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderNumber}.pdf`);
  doc.pipe(res);

  const pageWidth = doc.page.width - 80;
  const leftMargin = 40;
  const rightMargin = doc.page.width - 40;

  // ═══════════════════════════════════════════════════════════════════
  // HEADER SECTION
  // ═══════════════════════════════════════════════════════════════════

  // Header background
  doc.rect(0, 0, doc.page.width, 120).fill(COLORS.primary);

  // Company name
  doc.fontSize(24)
    .fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .text(company.companyName || 'Eazy Wash', leftMargin, 35);

  // Company tagline/website
  doc.fontSize(10)
    .fillColor(COLORS.lightGray)
    .font('Helvetica')
    .text(company.website || 'www.eazywash.com', leftMargin, 65);

  // Invoice title on right
  doc.fontSize(28)
    .fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .text('INVOICE', rightMargin - 120, 40, { width: 120, align: 'right' });

  doc.fontSize(10)
    .fillColor(COLORS.lightGray)
    .font('Helvetica')
    .text(`#${orderNumber}`, rightMargin - 120, 72, { width: 120, align: 'right' });

  // ═══════════════════════════════════════════════════════════════════
  // INVOICE DETAILS BAR
  // ═══════════════════════════════════════════════════════════════════

  let y = 140;

  // Light background bar for invoice meta
  doc.rect(leftMargin, y, pageWidth, 50).fill('#f7fafc');

  // Invoice details in the bar
  const metaY = y + 15;

  doc.fontSize(9)
    .fillColor(COLORS.mutedText)
    .font('Helvetica')
    .text('Invoice Date', leftMargin + 20, metaY);
  doc.fontSize(11)
    .fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .text(formatDate(order.createdAt), leftMargin + 20, metaY + 14);

  doc.fontSize(9)
    .fillColor(COLORS.mutedText)
    .font('Helvetica')
    .text(isBooking ? 'Booking Ref' : 'Order Number', leftMargin + 150, metaY);
  doc.fontSize(11)
    .fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .text(orderNumber || 'N/A', leftMargin + 150, metaY + 14);

  doc.fontSize(9)
    .fillColor(COLORS.mutedText)
    .font('Helvetica')
    .text('Payment Status', leftMargin + 300, metaY);
  doc.fontSize(11)
    .fillColor(order.paymentStatus === 'paid' ? COLORS.success : COLORS.accent)
    .font('Helvetica-Bold')
    .text((order.paymentStatus || 'pending').toUpperCase(), leftMargin + 300, metaY + 14);

  doc.fontSize(9)
    .fillColor(COLORS.mutedText)
    .font('Helvetica')
    .text('Status', leftMargin + 420, metaY);
  doc.fontSize(11)
    .fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .text((order.status || 'processing').toUpperCase(), leftMargin + 420, metaY + 14);

  // ═══════════════════════════════════════════════════════════════════
  // FROM / TO SECTION
  // ═══════════════════════════════════════════════════════════════════

  y = 210;
  const colWidth = (pageWidth - 40) / 2;

  // FROM (Company)
  doc.fontSize(10)
    .fillColor(COLORS.accent)
    .font('Helvetica-Bold')
    .text('FROM', leftMargin, y);

  doc.moveTo(leftMargin, y + 15)
    .lineTo(leftMargin + 40, y + 15)
    .strokeColor(COLORS.accent)
    .lineWidth(2)
    .stroke();

  y += 25;
  doc.fontSize(12)
    .fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .text(company.companyName || 'Eazy Wash Services', leftMargin, y);

  y += 18;
  doc.fontSize(10)
    .fillColor(COLORS.mutedText)
    .font('Helvetica')
    .text(company.address || '', leftMargin, y);
  y += 14;
  doc.text(company.city || '', leftMargin, y);
  y += 14;
  if (company.phone) doc.text(`Phone: ${company.phone}`, leftMargin, y);
  y += 14;
  if (company.email) doc.text(`Email: ${company.email}`, leftMargin, y);
  y += 14;
  if (company.gst) {
    doc.fontSize(9)
      .fillColor(COLORS.secondary)
      .font('Helvetica-Bold')
      .text(`GSTIN: ${company.gst}`, leftMargin, y);
  }

  // TO (Customer)
  let toY = 210;
  const toX = leftMargin + colWidth + 40;

  doc.fontSize(10)
    .fillColor(COLORS.accent)
    .font('Helvetica-Bold')
    .text('BILL TO', toX, toY);

  doc.moveTo(toX, toY + 15)
    .lineTo(toX + 50, toY + 15)
    .strokeColor(COLORS.accent)
    .lineWidth(2)
    .stroke();

  toY += 25;
  // Handle populated user/customer fields
  const customerName = order.userId?.name || order.customer?.name || 'Customer';
  doc.fontSize(12)
    .fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .text(customerName, toX, toY);

  toY += 18;
  doc.fontSize(10)
    .fillColor(COLORS.mutedText)
    .font('Helvetica');

  if (address.line1) {
    doc.text(address.line1, toX, toY);
    toY += 14;
  }
  if (address.line2) {
    doc.text(address.line2, toX, toY);
    toY += 14;
  }
  if (address.city || address.state || address.pincode) {
    doc.text(`${address.city || ''}, ${address.state || ''} ${address.pincode || ''}`.trim(), toX, toY);
    toY += 14;
  }
  if (address.phone) {
    doc.text(`Phone: ${address.phone}`, toX, toY);
  }

  // ═══════════════════════════════════════════════════════════════════
  // ITEMS TABLE
  // ═══════════════════════════════════════════════════════════════════

  y = 360;

  // Table header
  doc.rect(leftMargin, y, pageWidth, 35).fill(COLORS.primary);

  doc.fontSize(10)
    .fillColor(COLORS.white)
    .font('Helvetica-Bold');

  const col1 = leftMargin + 15;
  const col2 = leftMargin + 280;
  const col3 = leftMargin + 350;
  const col4 = rightMargin - 80;

  doc.text('#', col1, y + 12);
  doc.text('ITEM', col1 + 20, y + 12);
  doc.text('QTY', col2, y + 12);
  doc.text('PRICE', col3, y + 12);
  doc.text('AMOUNT', col4, y + 12, { width: 70, align: 'right' });

  y += 35;

  // Table rows
  items.forEach((item, idx) => {
    const unitPrice = item.unitPrice || item.price || 0;
    const subtotal = item.subtotal || unitPrice * item.quantity;
    const isEven = idx % 2 === 0;

    // Alternate row background
    if (isEven) {
      doc.rect(leftMargin, y, pageWidth, 30).fill('#f7fafc');
    }

    doc.fontSize(10)
      .fillColor(COLORS.text)
      .font('Helvetica');

    doc.text(`${idx + 1}`, col1, y + 10);
    doc.font('Helvetica-Bold')
      .text(item.productName || item.name || 'Item', col1 + 20, y + 10, { width: 220 });
    doc.font('Helvetica')
      .text(item.quantity?.toString() || '1', col2, y + 10);
    doc.text(formatCurrency(unitPrice), col3, y + 10);
    doc.font('Helvetica-Bold')
      .text(formatCurrency(subtotal), col4, y + 10, { width: 70, align: 'right' });

    y += 30;
  });

  // Table bottom border
  doc.moveTo(leftMargin, y)
    .lineTo(rightMargin, y)
    .strokeColor(COLORS.lightGray)
    .lineWidth(1)
    .stroke();

  // ═══════════════════════════════════════════════════════════════════
  // TOTALS SECTION
  // ═══════════════════════════════════════════════════════════════════

  y += 20;
  const totalsX = rightMargin - 200;
  const totalsValueX = rightMargin - 80;

  // Calculate totals if not present (for bookings)
  let subtotal = order.subtotal;
  if (subtotal === undefined && isBooking) {
    subtotal = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  }

  // Subtotal
  doc.fontSize(10)
    .fillColor(COLORS.mutedText)
    .font('Helvetica')
    .text('Subtotal', totalsX, y);
  doc.fillColor(COLORS.text)
    .text(formatCurrency(subtotal || 0), totalsValueX, y, { width: 70, align: 'right' });
  y += 20;

  // Discount
  if (order.discount && order.discount > 0) {
    doc.fillColor(COLORS.success)
      .text('Discount', totalsX, y);
    doc.text(`-${formatCurrency(order.discount)}`, totalsValueX, y, { width: 70, align: 'right' });
    y += 20;
  }

  // Shipping
  if (order.shippingFee && order.shippingFee > 0) {
    doc.fillColor(COLORS.mutedText)
      .text('Shipping', totalsX, y);
    doc.fillColor(COLORS.text)
      .text(formatCurrency(order.shippingFee), totalsValueX, y, { width: 70, align: 'right' });
    y += 20;
  }

  // Tax
  if (order.tax && order.tax > 0) {
    doc.fillColor(COLORS.mutedText)
      .text('Tax', totalsX, y);
    doc.fillColor(COLORS.text)
      .text(formatCurrency(order.tax), totalsValueX, y, { width: 70, align: 'right' });
    y += 20;
  }

  // Total divider
  y += 5;
  doc.moveTo(totalsX - 10, y)
    .lineTo(rightMargin, y)
    .strokeColor(COLORS.primary)
    .lineWidth(2)
    .stroke();
  y += 15;

  // Total amount
  doc.rect(totalsX - 10, y - 5, rightMargin - totalsX + 10, 35).fill(COLORS.primary);

  doc.fontSize(12)
    .fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .text('TOTAL AMOUNT', totalsX, y + 5);

  doc.fontSize(14)
    .text(formatCurrency(order.totalAmount || subtotal), totalsValueX - 20, y + 3, { width: 90, align: 'right' });

  // ═══════════════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════════════

  const footerY = doc.page.height - 80;

  doc.moveTo(leftMargin, footerY)
    .lineTo(rightMargin, footerY)
    .strokeColor(COLORS.lightGray)
    .lineWidth(1)
    .stroke();

  doc.fontSize(9)
    .fillColor(COLORS.mutedText)
    .font('Helvetica')
    .text('Thank you for your business!', leftMargin, footerY + 15, { align: 'center', width: pageWidth });

  doc.text('This is a computer-generated invoice and does not require a signature.', leftMargin, footerY + 30, { align: 'center', width: pageWidth });

  if (company.email) {
    doc.text(`For queries, contact us at ${company.email}`, leftMargin, footerY + 45, { align: 'center', width: pageWidth });
  }

  doc.end();
};

module.exports = { streamInvoice };
