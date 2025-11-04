const Address = require('../models/address.model');
const { NotFoundError, UnauthorizedError, BadRequestError } = require('../utils/errors');

class AddressService {
  async listUserAddresses(userId) {
    return Address.find({ user: userId }).sort({ isPrimary: -1, updatedAt: -1 });
  }

  async createAddress(userId, input) {
    const count = await Address.countDocuments({ user: userId });
    const address = await Address.create({
      user: userId,
      ...input,
      isPrimary: count === 0 ? true : Boolean(input.isPrimary),
    });

    // If new address is marked primary, unset others
    if (address.isPrimary) {
      await Address.updateMany({ user: userId, _id: { $ne: address._id } }, { $set: { isPrimary: false } });
    }

    return address;
  }

  async updateAddress(userId, addressId, updates) {
    const address = await Address.findById(addressId);
    if (!address) throw new NotFoundError('Address not found');
    if (String(address.user) !== String(userId)) throw new UnauthorizedError('Not allowed');

    const allowed = ['label', 'line1', 'line2', 'city', 'state', 'pincode', 'landmark', 'phone'];
    for (const key of Object.keys(updates)) {
      if (allowed.includes(key)) address[key] = updates[key];
    }

    await address.save();
    return address;
  }

  async deleteAddress(userId, addressId) {
    const address = await Address.findById(addressId);
    if (!address) throw new NotFoundError('Address not found');
    if (String(address.user) !== String(userId)) throw new UnauthorizedError('Not allowed');

    const wasPrimary = address.isPrimary;
    await address.deleteOne();

    if (wasPrimary) {
      const next = await Address.findOne({ user: userId }).sort({ updatedAt: -1 });
      if (next) {
        next.isPrimary = true;
        await next.save();
      }
    }

    return { message: 'Address deleted successfully' };
  }

  async setPrimaryAddress(userId, addressId) {
    const address = await Address.findById(addressId);
    if (!address) throw new NotFoundError('Address not found');
    if (String(address.user) !== String(userId)) throw new UnauthorizedError('Not allowed');

    await Address.updateMany({ user: userId, _id: { $ne: addressId } }, { $set: { isPrimary: false } });
    address.isPrimary = true;
    await address.save();
    return address;
  }
}

module.exports = new AddressService();


