const authService = require('../services/auth.service');
const { BadRequestError } = require('../utils/errors');

const login = async (req, res, next) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    throw new BadRequestError('Identifier and password are required');
  }

  const { accessToken, refreshToken, user } = await authService.loginWithCredentials({ identifier, password });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    data: {
      token: accessToken,
      user
    }
  });
};

const googleAuth = async (req, res, next) => {
  const { code } = req.body;
  if (!code) {
    throw new BadRequestError('Authorization code is required');
  }

  const { accessToken, refreshToken, user } = await authService.googleLogin(code);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    data: {
      token: accessToken,
      user
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

  const { accessToken, refreshToken, user } = await authService.verifyPhoneOTP(phone, otp);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    data: {
      token: accessToken,
      user
    }
  });
};

const refresh = async (req, res, next) => {
  const { refreshToken } = req.cookies;
  
  if (!refreshToken) {
    throw new BadRequestError('Refresh token not found');
  }
  
  const { accessToken, user } = await authService.refreshAccessToken(refreshToken);
  
  res.json({ 
    success: true, 
    data: { token: accessToken, accessToken, user }
  });
};

const logout = async (req, res, next) => {
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/'
  });

  res.json({
    success: true,
    data: {
      message: 'Logged out successfully'
    }
  });
};

const register = async (req, res, next) => {
  const { phone, name, email, password, confirmPassword } = req.body;
  if (!phone || !name || !password) {
    throw new BadRequestError('Name, phone and password are required');
  }
  if (password !== confirmPassword) {
    throw new BadRequestError('Passwords do not match');
  }
  const { accessToken, refreshToken, user } = await authService.registerUser({ phone, name, email, password });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  res.status(201).json({
    success: true,
    data: {
      token: accessToken,
      user
    }
  });
};

const getMe = async (req, res, next) => {
  const user = await authService.getUserById(req.userId);
  res.json({
    success: true,
    data: user
  });
};

const sendPasswordResetOTP = async (req, res, next) => {
  const { identifier } = req.body;
  
  if (!identifier) {
    throw new BadRequestError('Email or phone number is required');
  }
  
  const result = await authService.sendPasswordResetOTP(identifier);
  
  res.json({ 
    success: true, 
    message: result.message 
  });
};

const resetPassword = async (req, res, next) => {
  const { identifier, otp, newPassword } = req.body;
  
  if (!identifier || !otp || !newPassword) {
    throw new BadRequestError('Email/phone, OTP, and new password are required');
  }
  
  const result = await authService.resetPasswordWithOTP(identifier, otp, newPassword);
  
  res.json({
    success: true,
    message: result.message
  });
};

module.exports = {
  googleAuth,
  sendOTP,
  verifyOTP,
  refresh,
  logout,
  register,
  getMe,
  login,
  sendPasswordResetOTP,
  resetPassword
};
