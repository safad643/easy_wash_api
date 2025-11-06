const { BadRequestError } = require('../utils/errors');

class CouponsController {
  async apply(req, res, next) {
    try {
      const { code, amount } = req.body || {};
      if (!code) throw new BadRequestError('Coupon code is required');
      const baseAmount = Number(amount || 0);

      // Simple demo rules
      let valid = false;
      let discountType = 'flat';
      let discountAmount = 0;

      const codeUpper = String(code).toUpperCase();
      if (codeUpper === 'SAVE10') {
        valid = true;
        discountType = 'percent';
        discountAmount = Math.round(baseAmount * 0.1);
      } else if (codeUpper === 'FLAT50') {
        valid = true;
        discountType = 'flat';
        discountAmount = 50;
      }

      const finalAmount = Math.max(0, baseAmount - discountAmount);

      res.json({
        success: true,
        data: {
          code: codeUpper,
          valid,
          discountType,
          discountAmount,
          finalAmount,
          message: valid ? 'Coupon applied' : 'Invalid coupon code',
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CouponsController();


