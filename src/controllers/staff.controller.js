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

  /**
   * Get staff collections grouped by date (for admin)
   * GET /admin/staff/:id/collections
   */
  async getCollections(req, res, next) {
    try {
      const { id } = req.params;
      const { days = 30, status } = req.query;
      const result = await staffService.getStaffCollections(id, {
        days: parseInt(days),
        status,
      });
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark a date's collection as received
   * POST /admin/staff/:id/handover
   */
  async markHandover(req, res, next) {
    try {
      const { id } = req.params;
      const { date } = req.body;
      const adminId = req.userId;

      if (!date) {
        return res.status(400).json({
          success: false,
          error: { message: 'Date is required' },
        });
      }

      const result = await staffService.markHandoverReceived(id, date, adminId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all staff on leave for a specific date
   * GET /admin/staff/leaves?date=YYYY-MM-DD
   */
  async getLeavesByDate(req, res, next) {
    try {
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          error: { message: 'Date query parameter is required' },
        });
      }

      const result = await staffService.getLeavesByDate(date);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark a staff member as on leave
   * POST /admin/staff/:id/leave
   */
  async markLeave(req, res, next) {
    try {
      const { id } = req.params;
      const { date, reason } = req.body;
      const adminId = req.userId;

      if (!date) {
        return res.status(400).json({
          success: false,
          error: { message: 'Date is required' },
        });
      }

      const result = await staffService.markLeave(id, date, reason, adminId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove leave for a staff member
   * DELETE /admin/staff/:id/leave?date=YYYY-MM-DD
   */
  async removeLeave(req, res, next) {
    try {
      const { id } = req.params;
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          error: { message: 'Date query parameter is required' },
        });
      }

      const result = await staffService.removeLeave(id, date);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StaffController();

