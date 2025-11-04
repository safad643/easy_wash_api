const axios = require('axios');
const config = require('../config/config');

const sendOTP = async (phone, otp) => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📱 OTP SMS');
  console.log(`Phone: ${phone}`);
  console.log(`OTP Code: ${otp}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  return { type: 'success', mock: true };
};



// Alternative: Twilio implementation (comment out MSG91 above and use this)
/*
const twilio = require('twilio');
const client = twilio(config.sms.accountSid, config.sms.authToken);

const sendOTP = async (phone, otp) => {
  try {
    await client.messages.create({
      body: `Your verification code is: ${otp}`,
      from: config.sms.phoneNumber,
      to: phone
    });
  } catch (error) {
    console.error('SMS sending failed:', error.message);
    throw new Error('Failed to send OTP');
  }
};
*/

module.exports = { sendOTP };
