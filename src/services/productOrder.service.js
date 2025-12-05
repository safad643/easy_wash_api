const ProductOrder = require('../models/productOrder.model');
const Product = require('../models/product.model');
const Address = require('../models/address.model');
const Cart = require('../models/cart.model');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const escapeRegex = (text = '') => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const resolveDateRange = (value) => {
  if (!value || typeof value !== 'string') return null;
  const end = new Date();
  const start = new Date();

  switch (value) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'last-7-days':
      start.setDate(start.getDate() - 7);
      break;
    case 'last-30-days':
      start.setDate(start.getDate() - 30);
      break;
    case 'last-3-months':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'last-6-months':
      start.setMonth(start.getMonth() - 6);
      break;
    case 'last-year':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      return null;
  }

  return { from: start, to: end };
};

const normalizeOrderItems = (items = []) =>
  items.map((item) => ({
    id: item._id ? String(item._id) : item.productId ? String(item.productId) : undefined,
    productId: item.productId,
    name: item.productName,
    quantity: item.quantity,
    price: item.unitPrice,
    subtotal: item.subtotal,
    image: item.productImage,
  }));

const formatOrderForAdmin = (orderDoc) => {
  if (!orderDoc) return null;
  const plain = typeof orderDoc.toObject === 'function' ? orderDoc.toObject() : orderDoc;

  const customerSource = plain.customer || plain.userId;
  const customer =
    customerSource && (customerSource._id || customerSource.id || customerSource.name)
      ? {
          id: customerSource._id ? String(customerSource._id) : customerSource.id ? String(customerSource.id) : undefined,
          name: customerSource.name,
          email: customerSource.email,
          phone: customerSource.phone,
        }
      : undefined;

  return {
    id: String(plain._id || plain.id),
    orderNumber: plain.orderNumber,
    status: plain.status,
    paymentStatus: plain.paymentStatus,
    paymentMethod: plain.paymentMethod,
    subtotal: plain.subtotal || 0,
    discount: plain.discount || 0,
    tax: plain.tax || 0,
    shippingFee: plain.shippingFee || 0,
    totalAmount: plain.totalAmount || plain.total || 0,
    total: plain.totalAmount || plain.total || 0,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    deliveryAddress: plain.deliveryAddress,
    items: normalizeOrderItems(plain.items || []),
    notes: (plain.notes || []).map((note) => ({
      note: note.note,
      addedBy: note.addedBy,
      addedAt: note.addedAt,
    })),
    customer,
  };
};

class ProductOrderService {
  async prepareOrderData(userId, payload = {}) {
    const {
      items,
      addressId,
      paymentMethod = 'cod',
      discount = 0,
      tax = 0,
      shippingFee = 0,
      notes,
      source = 'direct',
    } = payload;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestError('At least one item is required');
    }

    if (!addressId) {
      throw new BadRequestError('Delivery address is required');
    }

    const address = await Address.findOne({ _id: addressId, user: userId });
    if (!address) {
      throw new NotFoundError('Delivery address not found');
    }

    const productIds = items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } })
      .populate('category', 'isActive')
      .select('name price image isAvailable category stock');

    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const normalizedItems = items.map((item) => {
      const product = productMap.get(String(item.productId));
      if (!product) {
        throw new BadRequestError('One or more products are unavailable');
      }
      if (!product.isAvailable || (product.category && !product.category.isActive)) {
        throw new BadRequestError(`${product.name} is not available right now`);
      }
      const quantity = Math.max(1, item.quantity || 1);
      if (product.stock < quantity) {
        throw new BadRequestError(`${product.name} has only ${product.stock} left`);
      }
      const unitPrice = product.price;
      return {
        productId: product._id,
        productName: product.name,
        productImage: product.image,
        quantity,
        unitPrice,
        subtotal: unitPrice * quantity,
      };
    });

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);

    const normalizedDiscount = Math.max(0, Number(discount) || 0);
    const normalizedTax = Math.max(0, Number(tax) || 0);
    const normalizedShipping = Math.max(0, Number(shippingFee) || 0);
    const totalAmount = Math.max(0, subtotal - normalizedDiscount + normalizedTax + normalizedShipping);

    return {
      normalizedItems,
      subtotal,
      discount: normalizedDiscount,
      tax: normalizedTax,
      shippingFee: normalizedShipping,
      totalAmount,
      paymentMethod,
      notes: notes && typeof notes === 'string' ? notes.trim() : '',
      source,
      addressSnapshot: {
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        landmark: address.landmark,
        phone: address.phone,
      },
      addressId,
    };
  }

  async createOrder(userId, payload = {}) {
    const {
      normalizedItems,
      subtotal,
      discount,
      tax,
      shippingFee,
      totalAmount,
      paymentMethod = 'cod',
      notes,
      source,
      addressSnapshot,
      addressId,
    } = await this.prepareOrderData(userId, payload);

    const order = await ProductOrder.create({
      userId,
      items: normalizedItems,
      subtotal,
      discount,
      tax,
      shippingFee,
      totalAmount,
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
      deliveryAddress: addressSnapshot,
      notes: notes
        ? [
            {
              note: notes,
              addedBy: 'customer',
              addedAt: new Date(),
            },
          ]
        : undefined,
    });

    try {
      for (const item of normalizedItems) {
        const decrementResult = await Product.updateOne(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } }
        );

        if (decrementResult.modifiedCount === 0) {
          throw new BadRequestError(`${item.productName} just went out of stock`);
        }

        await Product.updateOne(
          { _id: item.productId, stock: { $lte: 0 }, isAvailable: true },
          { $set: { isAvailable: false } }
        );
      }
    } catch (error) {
      await ProductOrder.deleteOne({ _id: order._id });
      throw error;
    }

    if (source === 'cart') {
      await Cart.updateOne(
        { user: userId },
        { $set: { items: [], subtotal: 0, total: 0 } }
      );
    }

    return order;
  }

  async listOrders(userId, filters = {}) {
    const { status, fromDate, toDate, page = 1, limit = 10 } = filters;
    const query = { userId };

    if (status) {
      query.status = status;
    }

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.max(parseInt(limit, 10) || 10, 1);
    const skip = (numericPage - 1) * numericLimit;

    const [total, data] = await Promise.all([
      ProductOrder.countDocuments(query),
      ProductOrder.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numericLimit),
    ]);

    return {
      data,
      total,
      page: numericPage,
      limit: numericLimit,
      totalPages: Math.ceil(total / numericLimit),
    };
  }

  async previewOrder(userId, payload = {}) {
    return this.prepareOrderData(userId, payload);
  }

  async getOrder(userId, orderId) {
    const order = await ProductOrder.findOne({ _id: orderId, userId });
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    return order;
  }

  async cancelOrder(userId, orderId) {
    const order = await ProductOrder.findOne({ _id: orderId, userId });
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const normalizedStatus = (order.status || '').toLowerCase();
    const nonCancelableStatuses = new Set(['packed', 'shipped', 'out-for-delivery', 'delivered', 'returned']);

    if (normalizedStatus === 'cancelled') {
      return { message: 'Order already cancelled' };
    }

    if (nonCancelableStatuses.has(normalizedStatus)) {
      throw new BadRequestError('Order cannot be cancelled once it is packed.');
    }

    order.status = 'cancelled';
    if (order.paymentStatus === 'paid') {
      order.paymentStatus = 'refunded';
    }
    await order.save();

    return { message: 'Order cancelled successfully' };
  }

  async submitFeedback(userId, orderId, { rating, comment }) {
    if (!rating || rating < 1 || rating > 5) {
      throw new BadRequestError('Rating must be between 1 and 5');
    }

    const order = await ProductOrder.findOne({ _id: orderId, userId });
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    order.feedback = {
      rating,
      comment: comment || '',
      createdAt: new Date(),
    };
    await order.save();

    return { message: 'Feedback submitted successfully' };
  }

  async listAllOrders(filters = {}) {
    const {
      status,
      paymentStatus,
      fromDate,
      toDate,
      dateRange,
      search,
      page = 1,
      limit = 10,
    } = filters;

    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.max(parseInt(limit, 10) || 10, 1);
    const skip = (numericPage - 1) * numericLimit;

    const matchQuery = {};
    if (status) {
      matchQuery.status = status;
    }
    if (paymentStatus) {
      matchQuery.paymentStatus = paymentStatus;
    }

    let rangeFrom = fromDate ? new Date(fromDate) : null;
    let rangeTo = toDate ? new Date(toDate) : null;

    if (!rangeFrom && !rangeTo && dateRange) {
      const parsedRange = resolveDateRange(dateRange);
      if (parsedRange) {
        rangeFrom = parsedRange.from;
        rangeTo = parsedRange.to;
      }
    }

    if (rangeFrom || rangeTo) {
      matchQuery.createdAt = {};
      if (rangeFrom) matchQuery.createdAt.$gte = rangeFrom;
      if (rangeTo) matchQuery.createdAt.$lte = rangeTo;
    }

    const pipeline = [{ $match: matchQuery }];

    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'customer',
        },
      },
      {
        $unwind: {
          path: '$customer',
          preserveNullAndEmptyArrays: true,
        },
      }
    );

    if (search && typeof search === 'string') {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      pipeline.push({
        $match: {
          $or: [
            { orderNumber: regex },
            { 'customer.name': regex },
            { 'customer.email': regex },
            { 'customer.phone': regex },
          ],
        },
      });
    }

    const projectionStage = {
      $project: {
        _id: 1,
        orderNumber: 1,
        status: 1,
        paymentStatus: 1,
        paymentMethod: 1,
        subtotal: 1,
        discount: 1,
        tax: 1,
        shippingFee: 1,
        totalAmount: 1,
        createdAt: 1,
        updatedAt: 1,
        deliveryAddress: 1,
        items: 1,
        notes: 1,
        customer: {
          _id: '$customer._id',
          name: '$customer.name',
          email: '$customer.email',
          phone: '$customer.phone',
        },
      },
    };

    const dataPipeline = [
      ...pipeline,
      projectionStage,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: numericLimit },
    ];
    const countPipeline = [...pipeline, { $count: 'total' }];

    const [data, totalResult] = await Promise.all([
      ProductOrder.aggregate(dataPipeline),
      ProductOrder.aggregate(countPipeline),
    ]);

    const total = totalResult[0]?.total || 0;

    return {
      data: data.map(formatOrderForAdmin),
      total,
      page: numericPage,
      limit: numericLimit,
      totalPages: Math.ceil(total / numericLimit) || 0,
    };
  }

  async getOrderDocument(orderId) {
    return ProductOrder.findById(orderId).populate('userId', 'name email phone');
  }

  async getOrderForAdmin(orderId) {
    const order = await this.getOrderDocument(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    return formatOrderForAdmin(order);
  }

  async updateOrderStatusAdmin(orderId, { status, note, updatedBy }) {
    if (!status || typeof status !== 'string') {
      throw new BadRequestError('Status is required');
    }

    const allowedStatuses = ProductOrder.schema.path('status').enumValues;
    if (!allowedStatuses.includes(status)) {
      throw new BadRequestError('Invalid order status');
    }

    const order = await this.getOrderDocument(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    order.status = status;

    if (note) {
      order.notes = order.notes || [];
      order.notes.push({
        note,
        addedBy: updatedBy ? 'admin' : 'system',
        addedAt: new Date(),
      });
    }

    await order.save();
    return formatOrderForAdmin(order);
  }
}

module.exports = new ProductOrderService();
