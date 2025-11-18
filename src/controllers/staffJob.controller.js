const staffJobService = require('../services/staffJob.service');

class StaffJobController {
  /**
   * Get all jobs assigned to the logged-in staff member
   */
  async list(req, res, next) {
    try {
      const filters = {
        status: req.query.status,
        search: req.query.search,
        fromDate: req.query.fromDate,
        toDate: req.query.toDate,
        page: req.query.page || 1,
        limit: req.query.limit || 10,
      };

      // Remove undefined values
      Object.keys(filters).forEach(
        (key) => filters[key] === undefined && delete filters[key]
      );

      const result = await staffJobService.getAssignedJobs(req.userId, filters);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific job detail
   */
  async detail(req, res, next) {
    try {
      const { id } = req.params;
      const job = await staffJobService.getJobDetail(req.userId, id);
      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update job status (PATCH endpoint for general status updates)
   */
  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, notes, paymentReceived } = req.body || {};

      if (!status) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'status is required',
          },
        });
      }

      // Handle completed status with payment confirmation
      if (status === 'completed') {
        if (paymentReceived === undefined || typeof paymentReceived !== 'boolean') {
          return res.status(400).json({
            success: false,
            error: {
              message: 'paymentReceived (boolean) is required when marking job as completed',
            },
          });
        }

        const job = await staffJobService.completeJob(req.userId, id, {
          paymentReceived,
          notes,
        });

        return res.json({
          success: true,
          data: job,
          message: 'Job marked as completed successfully',
        });
      }

      // Handle couldn't reach status
      if (status === 'couldnt_reach') {
        const job = await staffJobService.markCouldntReach(req.userId, id, {
          notes,
        });

        return res.json({
          success: true,
          data: job,
          message: 'Job marked as couldn\'t reach successfully',
        });
      }

      // For other statuses, use a generic update method
      const job = await staffJobService.updateJobStatus(req.userId, id, {
        status,
        notes,
      });

      res.json({
        success: true,
        data: job,
        message: 'Job status updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark a job as completed (with payment confirmation) - POST endpoint
   */
  async complete(req, res, next) {
    try {
      const { id } = req.params;
      const { paymentReceived, notes } = req.body || {};

      // Validate paymentReceived is provided and is boolean
      if (paymentReceived === undefined || typeof paymentReceived !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'paymentReceived (boolean) is required',
          },
        });
      }

      const job = await staffJobService.completeJob(req.userId, id, {
        paymentReceived,
        notes,
      });

      res.json({
        success: true,
        data: job,
        message: 'Job marked as completed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark a job as "couldn't reach"
   */
  async markCouldntReach(req, res, next) {
    try {
      const { id } = req.params;
      const { notes } = req.body || {};

      const job = await staffJobService.markCouldntReach(req.userId, id, {
        notes,
      });

      res.json({
        success: true,
        data: job,
        message: 'Job marked as couldn\'t reach successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get work history (completed jobs)
   */
  async history(req, res, next) {
    try {
      const filters = {
        search: req.query.search,
        fromDate: req.query.fromDate,
        toDate: req.query.toDate,
      };

      // Remove undefined values
      Object.keys(filters).forEach(
        (key) => filters[key] === undefined && delete filters[key]
      );

      const history = await staffJobService.getWorkHistory(req.userId, filters);
      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StaffJobController();

