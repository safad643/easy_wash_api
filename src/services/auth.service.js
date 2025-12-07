const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');
const OTP = require('../models/otp.model');
const googleService = require('./google.service');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt.util');
const { sendOTP } = require('../utils/sms.util');
const { sendOTP: sendEmailOTP } = require('../utils/email.util');
const { UnauthorizedError, BadRequestError } = require('../utils/errors');

const loginWithCredentials = async ({ identifier, password }) => {
  // identifier can be email or phone
  if (!identifier || !password) {
    throw new BadRequestError('Identifier and password are required');
  }
  const query = identifier.includes('@') ? { email: identifier.toLowerCase() } : { phone: identifier };
  const user = await User.findOne(query).select('+password');
  if (!user || !user.password) {
    throw new UnauthorizedError('Invalid credentials');
  }
  
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // Check if user is suspended (for staff)
  if (user.role === 'staff' && user.status === 'suspended') {
    throw new UnauthorizedError('Your account has been suspended. Please contact administrator.');
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
    
    await OTP.deleteMany({ phone, purpose: 'verification' });
    
    // const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpCode = '123456';
    
    const hashedOTP = await bcrypt.hash(otpCode, 10);
    
    await OTP.create({
      phone,
      otp: hashedOTP,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      purpose: 'verification'
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
    const otpRecord = await OTP.findOne({ phone, purpose: 'verification' });
    
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

const changePassword = async (userId, currentPassword, newPassword) => {
  if (!currentPassword || !newPassword) {
    throw new BadRequestError('Current password and new password are required');
  }

  // Find user with password field
  const user = await User.findById(userId).select('+password');
  if (!user || !user.password) {
    throw new UnauthorizedError('User not found or password not set');
  }

  // Verify current password
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // Check if new password is different from current password
  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    throw new BadRequestError('New password must be different from current password');
  }

  // Hash and update password
  const passwordHash = await bcrypt.hash(newPassword, 10);
  user.password = passwordHash;
  await user.save();

  return { message: 'Password changed successfully' };
};

const sendPasswordResetOTP = async (identifier) => {
  try {
    if (!identifier) {
      throw new BadRequestError('Email or phone number is required');
    }

    // Determine if identifier is email or phone
    const isEmail = identifier.includes('@');
    const query = isEmail ? { email: identifier } : { phone: identifier };
    
    // Find user with password field
    const user = await User.findOne(query).select('+password');
    if (!user) {
      // Explicitly inform that account does not exist
      throw new BadRequestError('Account not found');
    }

    // Check if user has a password set
    if (!user.password) {
      throw new BadRequestError('Password not set for this account. Please use alternative login method.');
    }

    // Delete existing password reset OTPs
    const deleteQuery = isEmail ? { email: identifier, purpose: 'password-reset' } : { phone: identifier, purpose: 'password-reset' };
    await OTP.deleteMany(deleteQuery);

    // Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOTP = await bcrypt.hash(otpCode, 10);

    // Create OTP record
    const otpData = {
      otp: hashedOTP,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      purpose: 'password-reset'
    };

    if (isEmail) {
      otpData.email = identifier;
      await OTP.create(otpData);
      await sendEmailOTP(identifier, otpCode);
    } else {
      otpData.phone = identifier;
      await OTP.create(otpData);
      await sendOTP(identifier, otpCode);
    }

    return { message: 'If an account exists with this email/phone, an OTP has been sent' };
  } catch (error) {
    if (error.isOperational) throw error;
    throw new Error(`Failed to send password reset OTP: ${error.message}`);
  }
};

const resetPasswordWithOTP = async (identifier, otpCode, newPassword) => {
  try {
    if (!identifier || !otpCode || !newPassword) {
      throw new BadRequestError('Email/phone, OTP, and new password are required');
    }

    // Determine if identifier is email or phone
    const isEmail = identifier.includes('@');
    const query = isEmail ? { email: identifier, purpose: 'password-reset' } : { phone: identifier, purpose: 'password-reset' };

    // Find OTP record
    const otpRecord = await OTP.findOne(query);
    
    if (!otpRecord) {
      throw new UnauthorizedError('Invalid or expired OTP');
    }

    // Check if OTP has expired
    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      throw new UnauthorizedError('OTP has expired');
    }

    // Verify OTP
    const isValid = await bcrypt.compare(otpCode, otpRecord.otp);
    if (!isValid) {
      throw new UnauthorizedError('Invalid OTP');
    }

    // Find user
    const userQuery = isEmail ? { email: identifier } : { phone: identifier };
    const user = await User.findOne(userQuery).select('+password');
    
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.password) {
      throw new BadRequestError('Password not set for this account');
    }

    // Check if new password is different from current password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      await OTP.deleteOne({ _id: otpRecord._id });
      throw new BadRequestError('New password must be different from current password');
    }

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.password = passwordHash;
    await user.save();

    // Delete used OTP
    await OTP.deleteOne({ _id: otpRecord._id });

    return { message: 'Password reset successfully' };
  } catch (error) {
    if (error.isOperational) throw error;
    throw new Error(`Password reset failed: ${error.message}`);
  }
};

module.exports = {
  googleLogin,
  sendPhoneOTP,
  verifyPhoneOTP,
  refreshAccessToken,
  logout,
  registerUser,
  getUserById,
  loginWithCredentials,
  changePassword,
  sendPasswordResetOTP,
  resetPasswordWithOTP
};
