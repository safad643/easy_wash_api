const cartService = require('../services/cart.service');

const shapeCart = (cart, userId) => {
  const items = cart.items.map((it) => ({
    id: it._id.toString(),
    userId: userId.toString(),
    type: 'product',
    productId: it.product?._id?.toString() || it.product.toString(),
    quantity: it.quantity,
    price: it.unitPrice,
    product: it.product && it.product._id
      ? {
          id: it.product._id.toString(),
          name: it.product.name,
          image: it.product.image,
          price: it.product.price,
        }
      : undefined,
    createdAt: it.createdAt,
  }));
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  return {
    items,
    subtotal: cart.subtotal,
    tax: 0,
    total: cart.total,
    itemCount,
  };
};

const getCart = async (req, res, next) => {
  const cart = await cartService.getCart(req.userId);
  res.json({ success: true, data: shapeCart(cart, req.userId) });
};

const addToCart = async (req, res, next) => {
  const { itemId, quantity, type } = req.body;
  const cart = await cartService.addItem(req.userId, { itemId, quantity, type });
  res.status(201).json({ success: true, data: shapeCart(cart, req.userId) });
};

const updateCartItem = async (req, res, next) => {
  const { itemId } = req.params;
  const { quantity } = req.body;
  const cart = await cartService.updateItemQuantity(req.userId, itemId, quantity);
  res.json({ success: true, data: shapeCart(cart, req.userId) });
};

const removeCartItem = async (req, res, next) => {
  const { itemId } = req.params;
  const cart = await cartService.removeItem(req.userId, itemId);
  res.json({ success: true, data: shapeCart(cart, req.userId) });
};

const clearCart = async (req, res, next) => {
  const result = await cartService.clearCart(req.userId);
  res.json({ success: true, data: result });
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};


