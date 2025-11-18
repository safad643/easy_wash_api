const categoryService = require('../services/category.service');

const createCategory = async (req, res, next) => {
  const categoryData = req.body;
  const category = await categoryService.createCategory(categoryData);
  res.status(201).json({ success: true, data: category });
};

const getCategories = async (req, res, next) => {
  const filters = {
    type: req.query.type,
    status: req.query.status,
    search: req.query.search,
    page: req.query.page || 1,
    limit: req.query.limit || 10,
    sortBy: req.query.sortBy || 'name',
    sortOrder: req.query.sortOrder || 'asc',
  };

  Object.keys(filters).forEach((k) => filters[k] === undefined && delete filters[k]);

  const result = await categoryService.getCategories(filters);
  res.json({ success: true, data: result });
};

const getCategoryById = async (req, res, next) => {
  const { id } = req.params;
  const category = await categoryService.getCategoryById(id);
  res.json({ success: true, data: category });
};

const updateCategory = async (req, res, next) => {
  const { id } = req.params;
  const updateData = req.body;
  delete updateData._id;
  delete updateData.createdAt;
  const category = await categoryService.updateCategory(id, updateData);
  res.json({ success: true, data: category });
};

const deleteCategory = async (req, res, next) => {
  const { id } = req.params;
  const result = await categoryService.deleteCategory(id);
  
  let message = 'Category deleted successfully';
  if (result.totalDeletedItems > 0) {
    const items = [];
    if (result.deletedProductsCount > 0) {
      items.push(`${result.deletedProductsCount} product${result.deletedProductsCount !== 1 ? 's' : ''}`);
    }
    if (result.deletedServicesCount > 0) {
      items.push(`${result.deletedServicesCount} service${result.deletedServicesCount !== 1 ? 's' : ''}`);
    }
    message += `. Also deleted ${items.join(' and ')} associated with this category.`;
  }
  
  res.json({ 
    success: true, 
    message,
    data: {
      deletedProductsCount: result.deletedProductsCount,
      deletedServicesCount: result.deletedServicesCount,
      totalDeletedItems: result.totalDeletedItems,
    }
  });
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};


