const Product = require('../models/product.model');
const Category = require('../models/category.model');
const mongoose = require('mongoose');
const { BadRequestError, NotFoundError } = require('../utils/errors');

class ProductService {
  async createProduct(productData) {
    // Only check SKU uniqueness if SKU is provided and not empty
    if (productData.sku && productData.sku.trim() !== '') {
      const existingSKU = await Product.findOne({ sku: productData.sku.trim() });
      if (existingSKU) {
        throw new BadRequestError('SKU already exists');
      }
      // Trim and set the SKU
      productData.sku = productData.sku.trim();
    } else {
      // Remove empty or undefined SKU
      delete productData.sku;
    }

    // Handle category - convert name to ObjectId if needed
    if (productData.category && !mongoose.Types.ObjectId.isValid(productData.category)) {
      const categoryDoc = await Category.findOne({ 
        name: productData.category, 
        type: 'product' 
      });
      if (!categoryDoc) {
        throw new BadRequestError(`Category "${productData.category}" not found`);
      }
      productData.category = categoryDoc._id;
    }

    const product = new Product(productData);
    await product.save();
    // Populate category before returning
    await product.populate('category', 'name description icon isActive');
    return product;
  }

  async getProducts(filters = {}) {
    const {
      category,
      brand,
      search,
      minPrice,
      maxPrice,
      isAvailable,
      page = 1,
      limit = 10,
      sortBy = 'name',
      sortOrder = 'asc',
    } = filters;

    const query = {};

    // First, get all active category IDs to filter products
    const activeCategories = await Category.find({ 
      type: 'product', 
      isActive: true 
    }).select('_id');
    const activeCategoryIds = activeCategories.map(cat => cat._id);

    // If no active categories exist, return empty results
    if (activeCategoryIds.length === 0) {
      return {
        data: [],
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: 0,
      };
    }

    if (category) {
      // Handle both ObjectId and category name
      let categoryId;
      if (mongoose.Types.ObjectId.isValid(category)) {
        categoryId = new mongoose.Types.ObjectId(category);
      } else {
        // If it's a category name, find the category ID
        const categoryDoc = await Category.findOne({ 
          name: category, 
          type: 'product',
          isActive: true // Only find active categories
        });
        if (categoryDoc) {
          categoryId = categoryDoc._id;
        } else {
          // If category not found or inactive, return empty results
          return {
            data: [],
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: 0,
          };
        }
      }
      // Only set category filter if it's in the active categories list
      if (activeCategoryIds.some(id => id.toString() === categoryId.toString())) {
        query.category = categoryId;
      } else {
        // Category is inactive, return empty results
        return {
          data: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0,
        };
      }
    } else {
      // No specific category filter, but only show products from active categories
      query.category = { $in: activeCategoryIds };
    }

    if (brand) query.brand = brand;
    if (isAvailable !== undefined) query.isAvailable = isAvailable;

    if (search) {
      // Escape special regex characters to prevent regex injection
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Use regex for case-insensitive search on name, description, brand, and sku
      // This is more flexible than $text search and doesn't require text index
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
        { brand: { $regex: escapedSearch, $options: 'i' } },
        { sku: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = minPrice;
      if (maxPrice) query.price.$lte = maxPrice;
    }

    const sort = {};
    const allowedSort = ['name', 'price', 'rating'];
    const sortField = allowedSort.includes(sortBy) ? sortBy : 'name';
    sort[sortField] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate({
        path: 'category',
        select: 'name description icon isActive',
        match: { isActive: true } // Ensure category is active
      })
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Filter out any products where category population failed (inactive category)
    // This is a safety check, but the query already filters by active categories
    const filteredProducts = products.filter(product => product.category !== null);

    return {
      data: filteredProducts,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProductById(id) {
    const product = await Product.findById(id)
      .populate({
        path: 'category',
        select: 'name description icon isActive',
        match: { isActive: true } // Ensure category is active
      });
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    // Check if category is active (if populate failed, category will be null)
    if (!product.category || !product.category.isActive) {
      throw new NotFoundError('Product not found');
    }
    return product;
  }

  async updateProduct(id, updateData) {
    // Handle category - convert name to ObjectId if needed
    if (updateData.category && !mongoose.Types.ObjectId.isValid(updateData.category)) {
      const categoryDoc = await Category.findOne({ 
        name: updateData.category, 
        type: 'product' 
      });
      if (!categoryDoc) {
        throw new BadRequestError(`Category "${updateData.category}" not found`);
      }
      updateData.category = categoryDoc._id;
    }

    // Handle SKU - only check uniqueness if SKU is provided and not empty
    if (updateData.sku !== undefined) {
      if (updateData.sku && updateData.sku.trim() !== '') {
        const trimmedSKU = updateData.sku.trim();
        // Check if SKU exists for a different product
        const existingSKU = await Product.findOne({ 
          sku: trimmedSKU,
          _id: { $ne: id } // Exclude current product
        });
        if (existingSKU) {
          throw new BadRequestError('SKU already exists');
        }
        updateData.sku = trimmedSKU;
      } else {
        // Remove empty SKU
        updateData.sku = undefined;
      }
    }

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('category', 'name description icon isActive');

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
    const Category = require('../models/category.model');
    // Get distinct category IDs from products
    const categoryIds = await Product.distinct('category');
    // Fetch category details for product type
    const categories = await Category.find({
      _id: { $in: categoryIds },
      type: 'product',
      isActive: true,
    })
      .select('name')
      .sort('name');
    // Return just the names as strings for backward compatibility
    return categories.map(cat => cat.name).sort();
  }
}

module.exports = new ProductService();
