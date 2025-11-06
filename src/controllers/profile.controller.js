const authService = require('../services/auth.service');
const profileService = require('../services/profile.service');
const { BadRequestError } = require('../utils/errors');

const changePassword = async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    throw new BadRequestError('Current password and new password are required');
  }

  if (newPassword !== confirmPassword) {
    throw new BadRequestError('New password and confirm password do not match');
  }

  const result = await authService.changePassword(req.userId, currentPassword, newPassword);

  res.json({
    success: true,
    data: result
  });
};

module.exports = {
  changePassword,
  async getProfile(req, res) {
    const data = await profileService.getProfile(req.userId);
    res.json({ success: true, data });
  },
  async updateProfile(req, res) {
    const data = await profileService.updateProfile(req.userId, req.body || {});
    res.json({ success: true, data });
  },
  async deleteAccount(req, res) {
    const data = await profileService.deleteAccount(req.userId);
    res.json({ success: true, data });
  }
};


