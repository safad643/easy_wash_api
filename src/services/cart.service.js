const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const { BadRequestError, NotFoundError } = require('../utils/errors');

class CartService {
  async getOrCreateCart(userId) {
    let cart = await Cart.findOne({ user: userId }).populate({ path: 'items.product', select: 'name price image isAvailable' });
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [], subtotal: 0, total: 0 });
    }
    return cart;
  }

  async getCart(userId) {
    const cart = await this.getOrCreateCart(userId);
    cart.recalculateTotals();
    await cart.save();
    return cart;
  }

  async addItem(userId, { itemId, quantity = 1, type = 'product' }) {
    if (type !== 'product') {
      throw new BadRequestError('Only product cart items are supported currently');
    }

    const product = await Product.findById(itemId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    if (!product.isAvailable) {
      throw new BadRequestError('Product is not available');
    }

    const cart = await this.getOrCreateCart(userId);

    const existing = cart.items.find((i) => i.product.toString() === product._id.toString());
    if (existing) {
      existing.quantity += quantity;
      existing.unitPrice = product.price; // keep latest price
    } else {
      cart.items.push({ product: product._id, quantity, unitPrice: product.price });
    }

    cart.recalculateTotals();
    await cart.save();
    await cart.populate({ path: 'items.product', select: 'name price image isAvailable' });
    return cart;
  }

  async updateItemQuantity(userId, itemId, quantity) {
    if (quantity < 1) {
      throw new BadRequestError('Quantity must be at least 1');
    }

    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.id(itemId);
    if (!item) {
      throw new NotFoundError('Cart item not found');
    }

    // Refresh unit price from product in case it changed
    const product = await Product.findById(item.product);
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    item.quantity = quantity;
    item.unitPrice = product.price;

    cart.recalculateTotals();
    await cart.save();
    await cart.populate({ path: 'items.product', select: 'name price image isAvailable' });
    return cart;
  }

  async removeItem(userId, itemId) {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.id(itemId);
    if (!item) {
      throw new NotFoundError('Cart item not found');
    }
    item.deleteOne();
    cart.recalculateTotals();
    await cart.save();
    await cart.populate({ path: 'items.product', select: 'name price image isAvailable' });
    return cart;
  }

  async clearCart(userId) {
    const cart = await this.getOrCreateCart(userId);
    cart.items = [];
    cart.recalculateTotals();
    await cart.save();
    return { message: 'Cart cleared successfully' };
  }
}

module.exports = new CartService();



