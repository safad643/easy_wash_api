const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');
const { BadRequestError, UnauthorizedError } = require('../utils/errors');

const shapeUserProfile = (userDoc) => {
  if (!userDoc) return null;
  return {
    id: userDoc._id.toString(),
    name: userDoc.name || '',
    email: userDoc.email || undefined,
    phone: userDoc.phone || '',
    avatar: userDoc.avatar || undefined,
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
  };
};

const getProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new UnauthorizedError('User not found');
  return shapeUserProfile(user);
};

const updateProfile = async (userId, updates) => {
  const allowed = ['name', 'email', 'avatar'];
  const payload = {};
  for (const key of allowed) {
    if (typeof updates[key] !== 'undefined') payload[key] = updates[key];
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'email') && payload.email) {
    const existing = await User.findOne({ email: payload.email, _id: { $ne: userId } });
    if (existing) {
      throw new BadRequestError('Email is already in use');
    }
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: payload },
    { new: true }
  );
  if (!user) throw new UnauthorizedError('User not found');
  return shapeUserProfile(user);
};

const deleteAccount = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new UnauthorizedError('User not found');

  await RefreshToken.deleteMany({ userId });
  await User.deleteOne({ _id: userId });
  return { message: 'Account deleted successfully' };
};

module.exports = {
  getProfile,
  updateProfile,
  deleteAccount,
};


