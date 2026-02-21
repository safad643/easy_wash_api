const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');
const OTP = require('../models/otp.model');
const googleService = require('./google.service');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt.util');
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


// Send OTP to email for login (requires existing account)
const sendEmailLoginOTP = async (email) => {
  try {
    if (!email || !email.includes('@')) {
      throw new BadRequestError('Valid email is required');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if account exists
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new BadRequestError('No account found with this email');
    }

    // Delete existing verification OTPs for this email
    await OTP.deleteMany({ email: normalizedEmail, purpose: 'verification' });

    // Generate random 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    const hashedOTP = await bcrypt.hash(otpCode, 10);

    await OTP.create({
      email: normalizedEmail,
      otp: hashedOTP,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      purpose: 'verification'
    });

    await sendEmailOTP(normalizedEmail, otpCode);

    return { message: 'OTP sent to your email' };
  } catch (error) {
    if (error.isOperational) throw error;
    throw new Error(`Failed to send email OTP: ${error.message}`);
  }
};

// Verify email OTP for login (no auto-registration)
const verifyEmailLoginOTP = async (email, otpCode) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const otpRecord = await OTP.findOne({ email: normalizedEmail, purpose: 'verification' });

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

    // Find existing user (no auto-registration for email OTP login)
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new UnauthorizedError('No account found with this email');
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
    throw new Error(`Email OTP verification failed: ${error.message}`);
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

// Send OTP for registration (before account creation)
const sendRegistrationOTP = async (email) => {
  try {
    if (!email || !email.includes('@')) {
      throw new BadRequestError('Valid email is required');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if account already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new BadRequestError('An account already exists with this email');
    }

    // Delete existing registration OTPs for this email
    await OTP.deleteMany({ email: normalizedEmail, purpose: 'registration' });

    // Generate random 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    const hashedOTP = await bcrypt.hash(otpCode, 10);

    await OTP.create({
      email: normalizedEmail,
      otp: hashedOTP,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      purpose: 'registration'
    });

    await sendEmailOTP(normalizedEmail, otpCode);

    return { message: 'OTP sent to your email for verification' };
  } catch (error) {
    if (error.isOperational) throw error;
    throw new Error(`Failed to send registration OTP: ${error.message}`);
  }
};

const registerUser = async ({ phone, name, email, password, otp }) => {
  if (!phone || !password || !name || !email || !otp) {
    throw new BadRequestError('Name, phone, email, password and OTP are required');
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Verify OTP first
  const otpRecord = await OTP.findOne({ email: normalizedEmail, purpose: 'registration' });

  if (!otpRecord) {
    throw new BadRequestError('Invalid or expired OTP. Please request a new one.');
  }

  if (otpRecord.expiresAt < new Date()) {
    await OTP.deleteOne({ _id: otpRecord._id });
    throw new BadRequestError('OTP has expired. Please request a new one.');
  }

  const isValidOTP = await bcrypt.compare(otp, otpRecord.otp);
  if (!isValidOTP) {
    throw new BadRequestError('Invalid OTP');
  }

  // Delete the used OTP
  await OTP.deleteOne({ _id: otpRecord._id });

  // Check for existing user
  const existing = await User.findOne({ $or: [{ phone }, { email: normalizedEmail }] });
  if (existing) {
    throw new BadRequestError('User already exists with provided phone/email');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ phone, name, email: normalizedEmail, password: passwordHash, role: 'customer' });
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

const sendPasswordResetOTP = async (email) => {
  try {
    if (!email || !email.includes('@')) {
      throw new BadRequestError('Valid email is required for password reset');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      throw new BadRequestError('Account not found');
    }

    if (!user.password) {
      throw new BadRequestError('Password not set for this account. Please use alternative login method.');
    }

    await OTP.deleteMany({ email: normalizedEmail, purpose: 'password-reset' });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOTP = await bcrypt.hash(otpCode, 10);

    await OTP.create({
      email: normalizedEmail,
      otp: hashedOTP,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      purpose: 'password-reset'
    });

    await sendEmailOTP(normalizedEmail, otpCode);

    return { message: 'If an account exists with this email, an OTP has been sent' };
  } catch (error) {
    if (error.isOperational) throw error;
    throw new Error(`Failed to send password reset OTP: ${error.message}`);
  }
};

const resetPasswordWithOTP = async (email, otpCode, newPassword) => {
  try {
    if (!email || !email.includes('@') || !otpCode || !newPassword) {
      throw new BadRequestError('Email, OTP, and new password are required');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const otpRecord = await OTP.findOne({ email: normalizedEmail, purpose: 'password-reset' });

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

    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.password) {
      throw new BadRequestError('Password not set for this account');
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      await OTP.deleteOne({ _id: otpRecord._id });
      throw new BadRequestError('New password must be different from current password');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.password = passwordHash;
    await user.save();

    await OTP.deleteOne({ _id: otpRecord._id });

    return { message: 'Password reset successfully' };
  } catch (error) {
    if (error.isOperational) throw error;
    throw new Error(`Password reset failed: ${error.message}`);
  }
};

module.exports = {
  googleLogin,
  sendEmailLoginOTP,
  verifyEmailLoginOTP,
  refreshAccessToken,
  logout,
  sendRegistrationOTP,
  registerUser,
  getUserById,
  loginWithCredentials,
  changePassword,
  sendPasswordResetOTP,
  resetPasswordWithOTP
};
