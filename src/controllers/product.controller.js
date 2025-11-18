const productService = require('../services/product.service');
const { BadRequestError } = require('../utils/errors');

const createProduct = async (req, res, next) => {
  try {
    const productData = req.body;
    const product = await productService.createProduct(productData);
    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

const getProducts = async (req, res, next) => {
  // Handle both 'status' (active/inactive) and 'isAvailable' (boolean) for backward compatibility
  let isAvailable;
  if (req.query.status !== undefined) {
    isAvailable = req.query.status === 'active';
  } else if (req.query.isAvailable !== undefined) {
    isAvailable = req.query.isAvailable === 'true';
  }

  const filters = {
    category: req.query.category,
    brand: req.query.brand,
    search: req.query.search,
    minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
    isAvailable: isAvailable,
    page: req.query.page || 1,
    limit: req.query.limit || req.query.pageSize || 10, // Support both limit and pageSize
    sortBy: req.query.sortBy || 'name',
    sortOrder: req.query.sortOrder || 'asc',
  };

  // Remove undefined values
  Object.keys(filters).forEach(
    (key) => filters[key] === undefined && delete filters[key]
  );

  const result = await productService.getProducts(filters);
 res.json({
    success: true,
    data: result, 
  });
};

const getProductById = async (req, res, next) => {
  const { id } = req.params;
  const product = await productService.getProductById(id);
  res.json({
    success: true,
    data: product,
  });
};

const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Prevent changing these fields
    delete updateData._id;
    delete updateData.createdAt;

    const product = await productService.updateProduct(id, updateData);
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  const { id } = req.params;
  await productService.deleteProduct(id);
  res.json({
    success: true,
    message: 'Product deleted successfully',
  });
};

const getCategories = async (req, res, next) => {
  const categories = await productService.getCategories();
  res.json({
    success: true,
    data: categories,
  });
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getCategories,
};
