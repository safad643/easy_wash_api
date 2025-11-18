const Category = require('../models/category.model');
const { NotFoundError, BadRequestError } = require('../utils/errors');

class CategoryService {
  async createCategory(categoryData) {
    const existing = await Category.findOne({ name: categoryData.name, type: categoryData.type });
    if (existing) {
      throw new BadRequestError('Category with this name and type already exists');
    }
    const category = new Category(categoryData);
    await category.save();
    return category;
  }

  async getCategories(filters = {}) {
    const {
      type,
      status, // 'active' | 'inactive'
      search,
      page = 1,
      limit = 10,
      sortBy = 'name',
      sortOrder = 'asc',
    } = filters;

    const query = {};
    if (type) query.type = type;
    if (status) query.isActive = status === 'active';
    if (search) query.$text = { $search: search };

    const sort = {};
    const allowedSort = ['name', 'createdAt'];
    const sortField = allowedSort.includes(sortBy) ? sortBy : 'name';
    sort[sortField] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const total = await Category.countDocuments(query);
    const categories = await Category.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Count items in each category (products/services)
    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat) => {
        const count = await this.getItemCount(cat.type, cat._id.toString());
        return { ...cat.toObject(), itemCount: count };
      })
    );

    return {
      data: categoriesWithCounts,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  async getCategoryById(id) {
    const category = await Category.findById(id);
    if (!category) throw new NotFoundError('Category not found');
    
    const count = await this.getItemCount(category.type, id);
    return { ...category.toObject(), itemCount: count };
  }

  async updateCategory(id, updateData) {
    // Prevent duplicate name+type
    if (updateData.name || updateData.type) {
      const existing = await Category.findOne({
        _id: { $ne: id },
        name: updateData.name || (await Category.findById(id))?.name,
        type: updateData.type || (await Category.findById(id))?.type,
      });
      if (existing) {
        throw new BadRequestError('Category with this name and type already exists');
      }
    }

    const category = await Category.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!category) throw new NotFoundError('Category not found');
    
    const count = await this.getItemCount(category.type, id);
    return { ...category.toObject(), itemCount: count };
  }

  async deleteCategory(id) {
    // First, get the category to know its name and type
    const category = await Category.findById(id);
    if (!category) throw new NotFoundError('Category not found');

    let deletedProductsCount = 0;

    // Delete all products that reference this category by ObjectId
    // Categories are now only for products
    const Product = require('../models/product.model');
    const deleteResult = await Product.deleteMany({ category: id });
    deletedProductsCount = deleteResult.deletedCount;

    // Now delete the category itself
    await Category.findByIdAndDelete(id);

    return {
      category,
      deletedProductsCount,
      deletedServicesCount: 0,
      totalDeletedItems: deletedProductsCount,
    };
  }

  async getItemCount(type, categoryId) {
    const mongoose = require('mongoose');
    if (type === 'product') {
      const Product = require('../models/product.model');
      return await Product.countDocuments({ category: categoryId });
    }
    return 0;
  }
}

module.exports = new CategoryService();


