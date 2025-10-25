const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');
const OTP = require('../models/otp.model');
const googleService = require('./google.service');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt.util');
const { sendOTP } = require('../utils/sms.util');
const { UnauthorizedError, BadRequestError } = require('../utils/errors');

const googleLogin = async (authCode) => {
  try {
    const googleUser = await googleService.verifyAuthCode(authCode);
    
    if (!googleUser.emailVerified) {
      throw new UnauthorizedError('Email not verified with Google');
    }
    
    let user = await User.findOne({ googleId: googleUser.id });
    if (!user) {
      user = await User.create({
        googleId: googleUser.id,
        email: googleUser.email
      });
    }
    
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken();
    
    await RefreshToken.create({
      userId: user._id,
      token: await bcrypt.hash(refreshToken, 10),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
    
    return { accessToken, refreshToken };
  } catch (error) {
    if (error.isOperational) throw error;
    throw new Error(`Google login failed: ${error.message}`);
  }
};

const sendPhoneOTP = async (phone) => {
  try {
    if (!phone || !/^\+?[1-9]\d{1,14}$/.test(phone)) {
      throw new BadRequestError('Invalid phone number format');
    }
    
    await OTP.deleteMany({ phone });
    
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const hashedOTP = await bcrypt.hash(otpCode, 10);
    
    await OTP.create({
      phone,
      otp: hashedOTP,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    
    await sendOTP(phone, otpCode);
    
    return { message: 'OTP sent successfully' };
  } catch (error) {
    if (error.isOperational) throw error;
    throw new Error(`Failed to send OTP: ${error.message}`);
  }
};

const verifyPhoneOTP = async (phone, otpCode) => {
  try {
    const otpRecord = await OTP.findOne({ phone });
    
    if (!otpRecord) {
      throw new UnauthorizedError('Invalid or expired OTP');
    }
    
    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      throw new UnauthorizedError('OTP has expired');
    }
    
    const isValid = await bcrypt.compare(otpCode, otpRecord.otp);
    if (!isValid) {
      throw new UnauthorizedError('Invalid OTP');
    }
    
    await OTP.deleteOne({ _id: otpRecord._id });
    
    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({ phone });
    }
    
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken();
    
    await RefreshToken.create({
      userId: user._id,
      token: await bcrypt.hash(refreshToken, 10),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    
    return { accessToken, refreshToken };
  } catch (error) {
    if (error.isOperational) throw error;
    throw new Error(`OTP verification failed: ${error.message}`);
  }
};

const refreshAccessToken = async (refreshToken) => {
  try {
    const hashedToken = await bcrypt.hash(refreshToken, 10);
    
    const tokenRecord = await RefreshToken.findOne({ token: hashedToken });
    
    if (!tokenRecord) {
      throw new UnauthorizedError('Invalid refresh token');
    }
    
    if (tokenRecord.expiresAt < new Date()) {
      await RefreshToken.deleteOne({ _id: tokenRecord._id });
      throw new UnauthorizedError('Refresh token expired');
    }
    
    const accessToken = generateAccessToken(tokenRecord.userId);
    
    return { accessToken };
  } catch (error) {
    if (error.isOperational) throw error;
    throw new Error(`Token refresh failed: ${error.message}`);
  }
};

const logout = async (refreshToken) => {
  try {
    const hashedToken = await bcrypt.hash(refreshToken, 10);
    await RefreshToken.deleteOne({ token: hashedToken });
    return { message: 'Logged out successfully' };
  } catch (error) {
    throw new Error(`Logout failed: ${error.message}`);
  }
};

module.exports = {
  googleLogin,
  sendPhoneOTP,
  verifyPhoneOTP,
  refreshAccessToken,
  logout
};
