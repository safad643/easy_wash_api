const staffService = require('../services/staff.service');

class StaffController {
  async create(req, res, next) {
    try {
      const staff = await staffService.createStaff(req.body);
      res.status(201).json({
        success: true,
        data: staff,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const filters = {
        status: req.query.status,
        role: req.query.role,
        area: req.query.area,
        search: req.query.search,
        page: req.query.page || 1,
        limit: req.query.limit || 10,
      };

      // Remove undefined values
      Object.keys(filters).forEach(
        (key) => filters[key] === undefined && delete filters[key]
      );

      const result = await staffService.getStaffList(filters);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const staff = await staffService.getStaffById(id);
      res.json({
        success: true,
        data: staff,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const staff = await staffService.updateStaff(id, req.body);
      res.json({
        success: true,
        data: staff,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await staffService.deleteStaff(id);
      res.json({
        success: true,
        data: { message: 'Staff member deleted successfully' },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const staff = await staffService.updateStaffStatus(id, status);
      res.json({
        success: true,
        data: staff,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StaffController();

