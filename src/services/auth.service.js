const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');
const OTP = require('../models/otp.model');
const googleService = require('./google.service');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt.util');
const { sendOTP } = require('../utils/sms.util');
const { UnauthorizedError, BadRequestError } = require('../utils/errors');

const loginWithCredentials = async ({ identifier, password }) => {
  // identifier can be email or phone
  if (!identifier || !password) {
    throw new BadRequestError('Identifier and password are required');
  }
  const query = identifier.includes('@') ? { email: identifier } : { phone: identifier };
  const user = await User.findOne(query).select('+password');
  if (!user || !user.password) {
    throw new UnauthorizedError('Invalid credentials');
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken();

  await RefreshToken.create({
    userId: user._id,
    token: await bcrypt.hash(refreshToken, 10),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  return { accessToken, refreshToken, user };
};

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
    
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken();
    
    await RefreshToken.create({
      userId: user._id,
      token: await bcrypt.hash(refreshToken, 10),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
    
    return { accessToken, refreshToken, user };
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
    
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken();
    
    await RefreshToken.create({
      userId: user._id,
      token: await bcrypt.hash(refreshToken, 10),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    
    return { accessToken, refreshToken, user };
  } catch (error) {
    if (error.isOperational) throw error;
    throw new Error(`OTP verification failed: ${error.message}`);
  }
};

const refreshAccessToken = async (refreshToken) => {
  try {
    // Find refresh token by scanning and comparing hashes (bcrypt is salted)
    const tokenRecords = await RefreshToken.find({});
    let tokenRecord = null;
    for (const rec of tokenRecords) {
      const match = await bcrypt.compare(refreshToken, rec.token);
      if (match) {
        tokenRecord = rec;
        break;
      }
    }
    
    if (!tokenRecord) {
      throw new UnauthorizedError('Invalid refresh token');
    }
    
    if (tokenRecord.expiresAt < new Date()) {
      await RefreshToken.deleteOne({ _id: tokenRecord._id });
      throw new UnauthorizedError('Refresh token expired');
    }
    
    const user = await User.findById(tokenRecord.userId);
    if (!user) {
      throw new UnauthorizedError('User no longer exists');
    }
    const accessToken = generateAccessToken(user._id, user.role);
    
    return { accessToken, user };
  } catch (error) {
    if (error.isOperational) throw error;
    throw new Error(`Token refresh failed: ${error.message}`);
  }
};

const logout = async (refreshToken) => {
  try {
    // Delete matching refresh token
    const tokenRecords = await RefreshToken.find({});
    for (const rec of tokenRecords) {
      const match = await bcrypt.compare(refreshToken, rec.token);
      if (match) {
        await RefreshToken.deleteOne({ _id: rec._id });
        break;
      }
    }
    return { message: 'Logged out successfully' };
  } catch (error) {
    throw new Error(`Logout failed: ${error.message}`);
  }
};

const registerUser = async ({ phone, name, email, password }) => {
  if (!phone || !password || !name) {
    throw new BadRequestError('Name, phone and password are required');
  }
  const existing = await User.findOne({ $or: [{ phone }, { email }] });
  if (existing) {
    throw new BadRequestError('User already exists with provided phone/email');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ phone, name, email, password: passwordHash, role: 'customer' });
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken();
  await RefreshToken.create({
    userId: user._id,
    token: await bcrypt.hash(refreshToken, 10),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });
  return { accessToken, refreshToken, user };
};

const getUserById = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new UnauthorizedError('User not found');
  return user;
};

module.exports = {
  googleLogin,
  sendPhoneOTP,
  verifyPhoneOTP,
  refreshAccessToken,
  logout,
  registerUser,
  getUserById,
  loginWithCredentials
};
