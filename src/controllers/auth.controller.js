const authService = require('../services/auth.service');
const { logLoginAttempt } = require('../services/loginLog.service');
const { BadRequestError } = require('../utils/errors');

const login = async (req, res, next) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    throw new BadRequestError('Identifier and password are required');
  }
  try {
    const { accessToken, refreshToken, user } = await authService.loginWithCredentials({ identifier, password });

    await logLoginAttempt({
      req,
      identifier,
      method: 'credentials',
      user,
      success: true
    });

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
  } catch (error) {
    await logLoginAttempt({
      req,
      identifier,
      method: 'credentials',
      success: false,
      error
    });
    next(error);
  }
};

const googleAuth = async (req, res, next) => {
  const { code } = req.body;
  if (!code) {
    throw new BadRequestError('Authorization code is required');
  }
  try {
    const { accessToken, refreshToken, user } = await authService.googleLogin(code);

    await logLoginAttempt({
      req,
      identifier: user && (user.email || user.googleId),
      method: 'google',
      user,
      success: true
    });

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
  } catch (error) {
    await logLoginAttempt({
      req,
      identifier: null,
      method: 'google',
      success: false,
      error
    });
    next(error);
  }
};

const sendEmailOTP = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    throw new BadRequestError('Email is required');
  }

  const result = await authService.sendEmailLoginOTP(email);

  res.json({
    success: true,
    message: result.message
  });
};

const verifyEmailOTP = async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new BadRequestError('Email and OTP are required');
  }
  try {
    const { accessToken, refreshToken, user } = await authService.verifyEmailLoginOTP(email, otp);

    await logLoginAttempt({
      req,
      identifier: email.toLowerCase().trim(),
      method: 'email-otp',
      user,
      success: true
    });

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
  } catch (error) {
    await logLoginAttempt({
      req,
      identifier: email && email.toLowerCase().trim(),
      method: 'email-otp',
      success: false,
      error
    });
    next(error);
  }
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

const sendRegistrationOTP = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    throw new BadRequestError('Email is required');
  }

  const result = await authService.sendRegistrationOTP(email);

  res.json({
    success: true,
    message: result.message
  });
};

const register = async (req, res, next) => {
  const { phone, name, email, password, confirmPassword, otp } = req.body;
  if (!phone || !name || !email || !password || !otp) {
    throw new BadRequestError('Name, phone, email, password and OTP are required');
  }
  if (password !== confirmPassword) {
    throw new BadRequestError('Passwords do not match');
  }
  const { accessToken, refreshToken, user } = await authService.registerUser({ phone, name, email, password, otp });
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
  const { email } = req.body;

  if (!email) {
    throw new BadRequestError('Email is required');
  }

  const result = await authService.sendPasswordResetOTP(email);

  res.json({
    success: true,
    message: result.message
  });
};

const resetPassword = async (req, res, next) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    throw new BadRequestError('Email, OTP, and new password are required');
  }

  const result = await authService.resetPasswordWithOTP(email, otp, newPassword);

  res.json({
    success: true,
    message: result.message
  });
};

module.exports = {
  googleAuth,
  sendEmailOTP,
  verifyEmailOTP,
  refresh,
  logout,
  sendRegistrationOTP,
  register,
  getMe,
  login,
  sendPasswordResetOTP,
  resetPassword
};
