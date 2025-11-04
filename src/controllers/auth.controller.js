const authService = require('../services/auth.service');
const { BadRequestError } = require('../utils/errors');

const googleAuth = async (req, res, next) => {
  const { code } = req.body;
  if (!code) {
    throw new BadRequestError('Authorization code is required');
  }

  const { accessToken, refreshToken } = await authService.googleLogin(code);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    data: {
      accessToken
    }
  });
};

const sendOTP = async (req, res, next) => {
  const { phone } = req.body;
  
  if (!phone) {
    throw new BadRequestError('Phone number is required');
  }
  
  const result = await authService.sendPhoneOTP(phone);
  
  res.json({ 
    success: true, 
    message: result.message 
  });
};

const verifyOTP = async (req, res, next) => {
  
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    throw new BadRequestError('Phone and OTP are required');
  }

  const { accessToken, refreshToken } = await authService.verifyPhoneOTP(phone, otp);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    data: {
      accessToken
    }
  });
};

const refresh = async (req, res, next) => {
  const { refreshToken } = req.cookies;
  
  if (!refreshToken) {
    throw new BadRequestError('Refresh token not found');
  }
  
  const { accessToken } = await authService.refreshAccessToken(refreshToken);
  
  res.json({ 
    success: true, 
    accessToken 
  });
};

const logout = async (req, res, next) => {
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  res.clearCookie('refreshToken');

  res.json({
    success: true,
    data: {
      message: 'Logged out successfully'
    }
  });
};

module.exports = {
  googleAuth,
  sendOTP,
  verifyOTP,
  refresh,
  logout
};
