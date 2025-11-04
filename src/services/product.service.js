const Product = require('../models/product.model');
const { BadRequestError, NotFoundError } = require('../utils/errors');

class ProductService {
  async createProduct(productData) {
    const existingSKU = await Product.findOne({ sku: productData.sku });
    if (existingSKU) {
      throw new BadRequestError('SKU already exists');
    }

    const product = new Product(productData);
    await product.save();
    return product;
  }

  async getProducts(filters = {}) {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      active,
      page = 1,
      limit = 10,
      sortBy = 'name',
      sortOrder = 'asc',
    } = filters;

    const query = {};

    if (category) query.category = category;
    if (active !== undefined) query.active = active;

    if (search) {
      query.$text = { $search: search };
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = minPrice;
      if (maxPrice) query.price.$lte = maxPrice;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    return {
      data: products,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProductById(id) {
    const product = await Product.findById(id);
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    return product;
  }

  async updateProduct(id, updateData) {
    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }
    return product;
  }

  async deleteProduct(id) {
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    return product;
  }

  async getCategories() {
    const categories = await Product.distinct('category');
    return categories.sort();
  }
}

module.exports = new ProductService();
